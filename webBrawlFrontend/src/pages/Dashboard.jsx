import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGroups } from "../store/GroupContext";

export default function Dashboard() {
  const { groups, createGroup, deleteGroup, renameGroup } = useGroups();
  const navigate = useNavigate();
  const [newGroupName, setNewGroupName] = useState("");

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    createGroup(newGroupName);
    setNewGroupName("");
  };

  const handleRenameGroup = (group) => {
    const newName = prompt("Enter new group name:", group.name);
    if (newName && newName.trim() !== "") {
      renameGroup(group.id, newName.trim());
    }
  };
  return (
    <div>
      <div>THIS IS THE DASHBOARD</div>

      <input
        placeholder="Group name"
        value={newGroupName}
        onChange={(e) => setNewGroupName(e.target.value)}
      />
      <button onClick={handleCreateGroup}>
        Add a group
      </button>

      {Object.values(groups).map((group) => (
        <div key={group.id}>
          <div>{group.name}</div>
          <button onClick={() => navigate(`/group/${group.id}`)}>
            Go to group actions
          </button>
          <button onClick={() => deleteGroup(group.id)}>
            Delete group
          </button>
          <button onClick={() => handleRenameGroup(group)}>
            Rename group
          </button>
        </div>
      ))}
    </div>
  );
}
