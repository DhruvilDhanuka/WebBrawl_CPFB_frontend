import React, { createContext, useContext, useState, useEffect } from "react";
import { generateID } from "../utils/id";

const STORAGE_KEY = "splitsmart_groups_v1";

const GroupContext = createContext(null);

export function GroupProvider({ children }) {
    const [groups, setGroups] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error("Failed to read groups from localStorage:", error);
            return {};
        }
    });

    // Sync to localStorage whenever groups state changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
        } catch (error) {
            console.error("Failed to save groups to localStorage:", error);
        }
    }, [groups]);

    // Group actions
    const createGroup = (name) => {
        const trimmedName = name?.trim();
        if (!trimmedName) return null;

        const id = generateID();
        const newGroup = {
            id,
            name: trimmedName,
            members: {}, // keyed by memberId: { id, name, color }
            expenses: [], // list of expense objects: { id, description, amount, payerId, participantIds, date }
            createdAt: new Date().toISOString(),
        };

        setGroups((prev) => ({
            ...prev,
            [id]: newGroup,
        }));

        return id;
    };

    const renameGroup = (groupId, newName) => {
        const trimmedName = newName?.trim();
        if (!trimmedName) return;

        setGroups((prev) => {
            const group = prev[groupId];
            if (!group) return prev;
            return {
                ...prev,
                [groupId]: { ...group, name: trimmedName },
            };
        });
    };

    const deleteGroup = (groupId) => {
        setGroups((prev) => {
            const next = { ...prev };
            delete next[groupId];
            return next;
        });
    };

    // Member actions
    const addMember = (groupId, { name, color }) => {
        const trimmedName = name?.trim();
        if (!trimmedName) return null;

        const memberId = generateID();
        const newMember = {
            id: memberId,
            name: trimmedName,
            color: color || "#3B82F6",
        };

        setGroups((prev) => {
            const group = prev[groupId];
            if (!group) return prev;

            return {
                ...prev,
                [groupId]: {
                    ...group,
                    members: {
                        ...group.members,
                        [memberId]: newMember,
                    },
                },
            };
        });

        return memberId;
    };

    const removeMember = (groupId, memberId) => {
        const group = groups[groupId];
        if (!group || !group.members?.[memberId]) return false;

        const memberName = group.members[memberId].name || "Member";
        const involvedExpenses = (group.expenses || []).filter(
            (exp) =>
                exp.payerId === memberId ||
                (Array.isArray(exp.participantIds) && exp.participantIds.includes(memberId))
        );

        if (involvedExpenses.length > 0) {
            const count = involvedExpenses.length;
            const confirmed = window.confirm(
                `${memberName} is part of ${count} expense${count > 1 ? "s" : ""}. Are you sure you want to delete?`
            );
            if (!confirmed) return false;
        }

        setGroups((prev) => {
            const g = prev[groupId];
            if (!g || !g.members?.[memberId]) return prev;

            const updatedMembers = { ...g.members };
            delete updatedMembers[memberId];

            return {
                ...prev,
                [groupId]: {
                    ...g,
                    members: updatedMembers,
                },
            };
        });

        return true;
    };

    // Expense actions
    const addExpense = (groupId, expenseData) => {
        const expenseId = generateID();
        const newExpense = {
            id: expenseId,
            description: expenseData.description || "Expense",
            amount: expenseData.amount, // stored in paise (integer)
            payerId: expenseData.payerId,
            participantIds: expenseData.participantIds || [],
            shares: expenseData.shares || null,
            date: expenseData.date || new Date().toISOString(),
            createdAt: new Date().toISOString(),
        };

        setGroups((prev) => {
            const group = prev[groupId];
            if (!group) return prev;

            return {
                ...prev,
                [groupId]: {
                    ...group,
                    expenses: [newExpense, ...(group.expenses || [])],
                },
            };
        });

        return expenseId;
    };

    const deleteExpense = (groupId, expenseId) => {
        setGroups((prev) => {
            const group = prev[groupId];
            if (!group) return prev;

            return {
                ...prev,
                [groupId]: {
                    ...group,
                    expenses: (group.expenses || []).filter((exp) => exp.id !== expenseId),
                },
            };
        });
    };

    const importGroup = (importedGroup) => {
        if (!importedGroup || !importedGroup.id || !importedGroup.name) return null;

        setGroups((prev) => ({
            ...prev,
            [importedGroup.id]: importedGroup,
        }));

        return importedGroup.id;
    };

    return (
        <GroupContext.Provider
            value={{
                groups,
                createGroup,
                renameGroup,
                deleteGroup,
                addMember,
                removeMember,
                addExpense,
                deleteExpense,
                importGroup,
            }}
        >
            {children}
        </GroupContext.Provider>
    );
}

export function useGroups() {
    const context = useContext(GroupContext);
    if (!context) {
        throw new Error("useGroups must be used within a GroupProvider");
    }
    return context;
}
