const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;

// 1. Cấu hình nơi lưu trữ file
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/images/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Đặt tên file duy nhất để tránh trùng lặp và bảo mật
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// 2. Bộ lọc validate file (Kiểm tra MIME type và Extension)
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    
    const extension = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;

    if (allowedMimeTypes.includes(mimeType) && allowedExtensions.includes(extension)) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ cho phép upload file JPG, PNG hoặc GIF!'), false);
    }
};

// 3. Khởi tạo middleware Multer
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // Giới hạn 5MB
    },
    fileFilter: fileFilter
});

// Route xử lý upload
app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Vui lòng chọn file!' });
        }

        const filePath = req.file.path;
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        const mimeType = req.file.mimetype;
        const uploadDir = 'uploads/images/';
        
        // Tạo tên file cuối cùng
        const fileName = Date.now() + '-' + Math.round(Math.random() * 1E9) + fileExtension;
        const finalPath = path.join(uploadDir, fileName);

        if (mimeType === 'image/gif') {
            /**
             * TRƯỜNG HỢP GIF:
             * Lưu trực tiếp file gốc, không resize, không convert
             * Đảm bảo giữ nguyên các frame animation
             */
            fs.renameSync(filePath, finalPath);
        } else {
            /**
             * TRƯỜNG HỢP JPG/PNG:
             * Sử dụng Sharp để resize và optimize (ví dụ: giới hạn max width 1920px)
             * Điều này giúp tối ưu tốc độ tải trang
             */
            try {
                // Lưu ý: Cần cài đặt sharp qua lệnh: npm install sharp
                const sharp = require('sharp'); 
                await sharp(filePath)
                    .resize(1920, 1080, { 
                        fit: 'inside', 
                        withoutEnlargement: true 
                    })
                    .toFile(finalPath);
                
                // Xóa file tạm sau khi đã xử lý xong
                fs.unlinkSync(filePath);
            } catch (sharpError) {
                console.error('Sharp processing error:', sharpError);
                // Nếu sharp chưa cài hoặc lỗi, fallback về lưu trực tiếp
                fs.renameSync(filePath, finalPath);
            }
        }

        // Trả về đường dẫn file để frontend hiển thị
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/images/${fileName}`;
        
        res.status(200).json({
            message: 'Upload thành công!',
            url: fileUrl
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Cấu hình static folder để phục vụ ảnh đã upload
app.use('/uploads', express.static('uploads'));

// Xử lý lỗi từ Multer (ví dụ: quá dung lượng)
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File quá lớn! Giới hạn tối đa là 5MB.' });
        }
    }
    res.status(400).json({ message: err.message });
});

app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
