// utils.js

// ✅ Normalize strings (trim & lowercase)
function normalizeString(str) {
  return String(str || "").trim().toLowerCase();
}

// ================= CATEGORY / CLUB NAME =================
async function getCategoryName(categoryId) {
  const idStr = String(categoryId || "").trim();
  if (!idStr || normalizeString(idStr) === "n/a") return null;

  try {
    // 🔹 acadClubTable
    let docSnap = await db.collection("acadClubTable").doc(idStr).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return (
        data.club ||
        data.clubName ||
        data.group ||
        data.name ||
        data.title ||
        String(idStr)
      );
    }

    // 🔹 groupTable
    docSnap = await db.collection("groupTable").doc(idStr).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return (
        data.club ||
        data.clubName ||
        data.group ||
        data.name ||
        data.title ||
        String(idStr)
      );
    }

    return idStr; // fallback: raw ID
  } catch (err) {
    console.error("Error fetching category name:", err);
    return idStr;
  }
}

// ================= OFFICE NAME =================
async function getOfficeName(officeId) {
  const idStr = String(officeId || "").trim();
  if (!idStr) return null;

  try {
    const docSnap = await db.collection("officeTable").doc(idStr).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return (
        data.office ||
        data.officeName ||
        data.name ||
        data.title ||
        String(idStr)
      );
    }
    return idStr;
  } catch (err) {
    console.error("Error fetching office name:", err);
    return idStr;
  }
}

// ================= DEPARTMENT NAME =================
async function getDepartmentName(deptId) {
  const idStr = String(deptId || "").trim();
  if (!idStr) return null;

  try {
    const docSnap = await db.collection("departmentTable").doc(idStr).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return (
        data.department ||
        data.departmentName ||
        data.name ||
        data.code ||
        String(idStr)
      );
    }
    return idStr;
  } catch (err) {
    console.error("Error fetching department name:", err);
    return idStr;
  }
}

// ================= LAB NAME =================
async function getLabName(labId) {
  const idStr = String(labId || "").trim();
  if (!idStr) return null;

  try {
    const docSnap = await db.collection("labTable").doc(idStr).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return (
        data.lab ||
        data.labName ||
        data.name ||
        data.title ||
        String(idStr)
      );
    }
    return idStr;
  } catch (err) {
    console.error("Error fetching lab name:", err);
    return idStr;
  }
}

// ================= UNIVERSAL RESOLVER =================
// Decides whether to fetch office, category, or lab name automatically
async function getReadableName(id) {
  const idStr = String(id || "").trim();
  if (!idStr || normalizeString(idStr) === "n/a") return "N/A";

  try {
    if (idStr.startsWith("2")) {
      return await getLabName(idStr);      // e.g., 201 → "Computer Lab"
    }
    if (idStr.startsWith("3")) {
      return await getOfficeName(idStr);   // e.g., 301 → "Registrar"
    }
    if (idStr.startsWith("4")) {
      return await getCategoryName(idStr); // e.g., 402 → "Honors Society"
    }
    return idStr;
  } catch (err) {
    console.error("Error in getReadableName:", err);
    return idStr;
  }
}
