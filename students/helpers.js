// Normalize strings for safe matching
function normalizeString(str) {
  return String(str || "").trim().toLowerCase();
}

// Get human-readable category/club name
async function getCategoryName(categoryId) {
  if (!categoryId || categoryId.toLowerCase() === "n/a") return null;

  let docSnap = await db.collection("acadClubTable").doc(categoryId).get();
  if (docSnap.exists) {
    const data = docSnap.data();
    return data.club || data.clubName || data.name || categoryId;
  }

  docSnap = await db.collection("groupTable").doc(categoryId).get();
  if (docSnap.exists) {
    const data = docSnap.data();
    return data.club || data.clubName || data.name || categoryId;
  }

  return categoryId;
}

async function getOfficeName(officeId) {
  if (!officeId) return null;
  let docSnap = await db.collection("officeTable").doc(officeId).get();
  return docSnap.exists ? (docSnap.data().office || docSnap.data().name || officeId) : officeId;
}

async function getDepartmentName(deptId) {
  if (!deptId) return null;
  let docSnap = await db.collection("departmentTable").doc(deptId).get();
  return docSnap.exists ? (docSnap.data().department || docSnap.data().name || deptId) : deptId;
}

async function getLabName(labId) {
  if (!labId) return null;
  let docSnap = await db.collection("labTable").doc(labId).get();
  return docSnap.exists ? (docSnap.data().lab || docSnap.data().name || labId) : labId;
}

// Resolve collection name dynamically for office 301,310–314
async function getCollectionNameFromOffice(office, category, lab) {
  // Check groupTable (category numeric ID)
  if (category && /^\d+$/.test(category)) {
    const groupDoc = await db.collection("groupTable").doc(category).get();
    if (groupDoc.exists) return groupDoc.data().club;
  }

  // Check labTable
  if (lab) {
    const labDoc = await db.collection("labTable").doc(lab).get();
    if (labDoc.exists) return labDoc.data().lab;
  }

  return null;
}
