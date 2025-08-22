// utils.js

// Normalize strings (trim & lowercase)
function normalizeString(str) {
  return String(str || "").trim().toLowerCase();
}

// Category/Club Name
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

// Office Name
async function getOfficeName(officeId) {
  if (!officeId) return null;
  const docSnap = await db.collection("officeTable").doc(officeId).get();
  return docSnap.exists ? (docSnap.data().office || docSnap.data().name || officeId) : officeId;
}

// Department Name
async function getDepartmentName(deptId) {
  if (!deptId) return null;
  const docSnap = await db.collection("departmentTable").doc(deptId).get();
  return docSnap.exists ? (docSnap.data().department || docSnap.data().name || deptId) : deptId;
}

// Lab Name
async function getLabName(labId) {
  if (!labId) return null;
  try {
    const docSnap = await db.collection("labTable").doc(labId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return data.lab || data.name || labId;
    }
  } catch (err) {
    console.error("Error fetching lab name:", err);
  }
  return labId;
}
