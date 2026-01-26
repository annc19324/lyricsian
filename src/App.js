
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import EditorType1 from './pages/EditorType1';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor/1" element={<EditorType1 />} />
      </Routes>
    </Router>
  );
}

export default App;
