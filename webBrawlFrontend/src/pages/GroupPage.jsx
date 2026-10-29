import { useParams, useNavigate } from "react-router-dom";
import { useGroups } from "../store/GroupContext";
import { useState } from "react";

export default function GroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { groups, addMember, removeMember, addExpense, deleteExpense } = useGroups();
  const [newMember, setNewMember] = useState("");
  const [newMemberColor, setNewMemberColor] = useState("");

  const group = groups[id];
  if (!group) {
    return (
      <div>
        <h2>Group not found</h2>
        <button onClick={() => navigate("/")}>Back to Dashboard</button>
      </div>
    );
  }

  const members = group.members || {};


  const handleAddMember = () => {
    if (!newMember.trim()) return;
    addMember(id, { name: newMember.trim(), color: newMemberColor.trim() });
    setNewMember("");
    setNewMemberColor("");
  };


  return (
    <div>

      <button onClick={() => navigate("/")}>Back to Dashboard</button>
      <h1>{group.name}</h1>
      <p>Group ID: {id}</p>

      <div>Members in this group</div>

      <input value={newMember} onChange={(e) => setNewMember(e.target.value)} placeholder="Add a member" />
      <input value={newMemberColor} onChange={(e) => setNewMemberColor(e.target.value)} placeholder="Add a member color" />
      <button onClick={handleAddMember}>Add a member</button>

      {
        Object.values(members).map((member) => (
          <div key={member.id} style={{ backgroundColor: member.color }}>
            <div>{member.name}</div>
            <div>{member.id}</div>
          </div>
        ))
      }

    </div>
  );
}
