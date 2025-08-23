// utils.js
import { db } from "./firebaseConfig.js";

function normalizeString(str) {
  return String(str || "").trim().toLowerCase();
}

// Get human-readable names
async function getCategoryName(categoryId) {
  if (!categoryId || categoryId.toLowerCase() === "n/a") return null;

  let docSnap = await db.collection("acadClubTable").doc(categoryId).get();
  if (docSnap.exists) return docSnap.data().club || docSnap.data().clubName || docSnap.data().name || categoryId;

  docSnap = await db.collection("groupTable").doc(categoryId).get();
  if (docSnap.exists) return docSnap.data().club || docSnap.data().clubName || docSnap.data().name || categoryId;

  return categoryId;
}

async function getOfficeName(officeId) {
  if (!officeId) return null;
  const snap = await db.collection("officeTable").doc(officeId).get();
  return snap.exists ? snap.data().office || snap.data().name || officeId : officeId;
}

async function getDepartmentName(deptId) {
  if (!deptId) return null;
  const snap = await db.collection("departmentTable").doc(deptId).get();
  return snap.exists ? snap.data().department || snap.data().name || deptId : deptId;
}

async function getLabName(labId) {
  if (!labId) return null;
  const snap = await db.collection("labTable").doc(labId).get();
  return snap.exists ? snap.data().lab || snap.data().name || labId : labId;
}

export { normalizeString, getCategoryName, getOfficeName, getDepartmentName, getLabName };
