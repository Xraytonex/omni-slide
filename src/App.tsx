import { HashRouter, Route, Routes } from 'react-router-dom';
import EditorPage from './editor/EditorPage';
import HomePage from './home/HomePage';
import PresentPage from './present/PresentPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/deck/:id" element={<EditorPage />} />
        <Route path="/deck/:id/present" element={<PresentPage />} />
      </Routes>
    </HashRouter>
  );
}
