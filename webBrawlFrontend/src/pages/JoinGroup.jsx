import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useGroups } from "../store/GroupContext";
import { decodeGroupFromUrl } from "../utils/share";

export default function JoinGroup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { importGroup } = useGroups();
  const [error, setError] = useState(null);

  useEffect(() => {
    const data = searchParams.get("data");
    if (!data) {
      setError("No group data found in the link.");
      return;
    }

    const group = decodeGroupFromUrl(data);
    if (!group || !group.id || !group.name) {
      setError("This share link appears to be invalid or corrupted.");
      return;
    }

    importGroup(group);
    navigate(`/group/${group.id}`, { replace: true });
  }, [searchParams, importGroup, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex items-center justify-center p-4">
        <div className="bg-[#0f1422] p-6 rounded-2xl border border-slate-800 text-center max-w-sm w-full space-y-4">
          <h2 className="text-xl font-bold text-white">Unable to Import Group</h2>
          <p className="text-sm text-slate-400">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl transition-colors cursor-pointer"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex items-center justify-center p-4">
      <div className="bg-[#0f1422] p-6 rounded-2xl border border-slate-800 text-center max-w-sm w-full space-y-3">
        <div className="w-8 h-8 mx-auto border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-300">Importing shared group...</p>
      </div>
    </div>
  );
}
