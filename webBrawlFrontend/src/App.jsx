import { HashRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import GroupPage from "./pages/GroupPage";
import { GroupProvider } from "./store/GroupContext";
import "./App.css";

function App() {
  return (
    <GroupProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/group/:id" element={<GroupPage />} />
        </Routes>
      </HashRouter>
    </GroupProvider>
  );
}

export default App;
