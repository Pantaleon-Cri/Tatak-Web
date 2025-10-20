// DOM Elements
const openBtn = document.getElementById("openModalBtn");
const modal = document.getElementById("modalOverlay");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.querySelector(".save-btn");
const courseInput = document.getElementById("courseName");
const tableBody = document.querySelector("tbody");

// Firestore references
const courseCollection = db
  .collection("DataTable")
  .doc("Course")
  .collection("CourseDocs");

const deptCollection = db
  .collection("DataTable")
  .doc("Department")
  .collection("DepartmentDocs");

const clubCollection = db
  .collection("DataTable")
  .doc("Clubs")
  .collection("ClubsDocs");

// --- Cached Maps ---
let departmentMap = {};
let clubMap = {};

// --- Load Department Codes (CED, CBM, etc.) ---
async function loadDepartments() {
  const snapshot = await deptCollection.get();
  snapshot.forEach((doc) => {
    const data = doc.data();
    departmentMap[data.id] = data.code || "Unknown";
  });
  console.log("Department map:", departmentMap);
}

// --- Load Club Codes (e.g., MTH, SCI) ---
async function loadClubs() {
  const snapshot = await clubCollection.get();
  snapshot.forEach((doc) => {
    const data = doc.data();
    clubMap[data.id] = data.code || "Unknown";
  });
  console.log("Club map:", clubMap);
}

// --- Convert ID(s) → Readable Code ---
function getCodesFromIDs(ids, map) {
  if (!Array.isArray(ids)) ids = [ids];
  return ids.map((id) => map[id] || id);
}

// Open modal
openBtn.addEventListener("click", () => {
  courseInput.value = "";
  modal.style.display = "flex";
});

// Cancel modal
cancelBtn.addEventListener("click", () => {
  modal.style.display = "none";
});

// Close modal on outside click
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

// Save new course
saveBtn.addEventListener("click", async () => {
  const courseName = courseInput.value.trim();
  const deptCodeName = document.getElementById("deptCodeName").value.trim();
  const clubCodeName = document
    .getElementById("clubCodeName")
    .value.trim()
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "");

  if (!courseName) {
    alert("Please enter a course name.");
    return;
  }

  try {
    const snapshot = await courseCollection.get();
    const ids = snapshot.docs.map((doc) => parseInt(doc.id)).filter((id) => !isNaN(id));
    const nextIdNum = ids.length ? Math.max(...ids) + 1 : 1;
    const nextId = nextIdNum.toString();

    const data = {
      id: nextId,
      course: courseName,
      deptCodeName, // store department IDs
      clubCodeName, // store club IDs
    };

    await courseCollection.doc(nextId).set(data);
    addRowToTable(nextId, data);
    modal.style.display = "none";
  } catch (error) {
    console.error("Error saving course:", error);
    alert("Error saving course.");
  }
});

// Load on startup
window.addEventListener("DOMContentLoaded", async () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");
  usernameDisplay.textContent = storedAdminID || "Unknown";

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const keysToRemove = [
        "userData",
        "studentName",
        "schoolID",
        "studentID",
        "staffID",
        "designeeID",
        "category",
        "office",
        "department",
      ];
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      window.location.href = "../../../logout.html";
    });
  }

  try {
    // Load both mappings before loading courses
    await Promise.all([loadDepartments(), loadClubs()]);

    const snapshot = await courseCollection.get();
    const docs = snapshot.docs
      .filter((doc) => !isNaN(parseInt(doc.id)))
      .sort((a, b) => parseInt(a.id) - parseInt(b.id));

    docs.forEach((doc) => addRowToTable(doc.id, doc.data()));
  } catch (error) {
    console.error("Error loading courses:", error);
  }
});

// Add row to table
function addRowToTable(id, data) {
  const row = document.createElement("tr");

  // Department readable code
  const deptReadable = Array.isArray(data.deptCodeName)
    ? getCodesFromIDs(data.deptCodeName, departmentMap).join(", ")
    : getCodesFromIDs([data.deptCodeName], departmentMap).join(", ");

  // Club readable code(s)
  const clubReadable = Array.isArray(data.clubCodeName)
    ? getCodesFromIDs(data.clubCodeName, clubMap).join(", ")
    : getCodesFromIDs([data.clubCodeName], clubMap).join(", ");

  row.innerHTML = `
    <td>${id}</td>
    <td class="course-name">${data.course || ""}</td>
    <td>${deptReadable || ""}</td>
    <td>${clubReadable || ""}</td>
    <td>
      <button class="action-btn edit" data-id="${id}"><i class="fas fa-edit"></i></button>
      <button class="action-btn delete" data-id="${id}"><i class="fas fa-trash-alt"></i></button>
    </td>
  `;
  tableBody.appendChild(row);

  row.querySelector(".edit").addEventListener("click", handleEdit);
  row.querySelector(".delete").addEventListener("click", handleDelete);
}

// --- Edit Modal Logic ---
const editModal = document.getElementById("editModalOverlay");
const editCancelBtn = document.getElementById("editCancelBtn");
const editSaveBtn = document.getElementById("editSaveBtn");

const deleteModal = document.getElementById("deleteModalOverlay");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");

let currentEditId = null;
let currentDeleteId = null;
let currentDeleteRow = null;

async function handleEdit(e) {
  const id = e.currentTarget.dataset.id;
  const row = e.currentTarget.closest("tr");

  const courseName = row.querySelector("td:nth-child(2)").textContent.trim();
  const deptCodeName = row.querySelector("td:nth-child(3)").textContent.trim();
  const clubCodeName = row.querySelector("td:nth-child(4)").textContent.trim();

  currentEditId = id;
  document.getElementById("editCourseId").value = id;
  document.getElementById("editCourseName").value = courseName;
  document.getElementById("editDeptCodeName").value = deptCodeName;
  document.getElementById("editClubCodeName").value = clubCodeName;

  editModal.style.display = "flex";
}

editSaveBtn.addEventListener("click", async () => {
  const newCourse = document.getElementById("editCourseName").value.trim();
  const newDept = document.getElementById("editDeptCodeName").value.trim();
  const newClub = document
    .getElementById("editClubCodeName")
    .value.trim()
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "");

  if (!newCourse) {
    alert("Course name cannot be empty.");
    return;
  }

  try {
    await courseCollection.doc(currentEditId).update({
      course: newCourse,
      deptCodeName: newDept,
      clubCodeName: newClub,
    });

    const row = document.querySelector(`.edit[data-id="${currentEditId}"]`).closest("tr");
    row.querySelector("td:nth-child(2)").textContent = newCourse;
    row.querySelector("td:nth-child(3)").textContent = newDept;
    row.querySelector("td:nth-child(4)").textContent = newClub.join(", ");

    editModal.style.display = "none";
    currentEditId = null;
  } catch (error) {
    console.error("Error updating course:", error);
    alert("Update failed.");
  }
});

editCancelBtn.addEventListener("click", () => {
  editModal.style.display = "none";
  currentEditId = null;
});

// --- Delete Logic ---
function handleDelete(e) {
  currentDeleteId = e.currentTarget.dataset.id;
  currentDeleteRow = e.currentTarget.closest("tr");
  deleteModal.style.display = "flex";
}

deleteCancelBtn.addEventListener("click", () => {
  deleteModal.style.display = "none";
  currentDeleteId = null;
});

deleteConfirmBtn.addEventListener("click", async () => {
  try {
    await courseCollection.doc(currentDeleteId).delete();
    currentDeleteRow.remove();
    deleteModal.style.display = "none";
    currentDeleteId = null;
  } catch (error) {
    console.error("Error deleting course:", error);
    alert("Delete failed.");
  }
});

// --- Excel Upload ---
const uploadBtn = document.getElementById("uploadBtn");
const uploadInput = document.getElementById("uploadInput");

uploadBtn.addEventListener("click", () => uploadInput.click());
uploadInput.addEventListener("change", handleFileUpload);

async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (event) {
    const data = new Uint8Array(event.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    for (const row of jsonData) {
      const id = row["ID no."]?.toString().trim();
      const course = row["Course"]?.trim();
      const dept = row["Dept Code ID"]?.toString().trim() || "";
      const clubRaw = row["Club Code ID"]?.toString().trim() || "";
      const club = clubRaw.split(",").map((v) => v.trim()).filter((v) => v !== "");

      if (!id || !course) continue;

      try {
        const docRef = courseCollection.doc(id);
        const docSnap = await docRef.get();
        if (docSnap.exists) continue;

        const payload = {
          id,
          course,
          deptCodeName: dept,
          clubCodeName: club,
        };

        await docRef.set(payload);
        addRowToTable(id, payload);
      } catch (error) {
        console.error(`Failed to upload ${course}:`, error);
      }
    }

    alert("Upload complete!");
    uploadInput.value = "";
  };
  reader.readAsArrayBuffer(file);
}
// ============================ Download Course Template ============================
const downloadTemplateBtn = document.getElementById("downloadTemplate");

if (downloadTemplateBtn) {
  downloadTemplateBtn.addEventListener("click", (e) => {
    e.preventDefault();

    // 🔹 Header row
    const header = "ID no.,Course,Dept Code ID,Club Code ID\n";

    // 🔹 Example template row
    const templateData =
      "1,e.g (Bachelor of Arts in Philosophy),(Department ID),(Club ID)\n"; // Example: ID 1, course BSIT, department ENG-DEPT, club CEACSC

    // 🔹 Combine header + example
    const csvContent = header + templateData;

    // 🔹 Create CSV file blob
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    // 🔹 Create hidden link for download
    const link = document.createElement("a");
    link.href = url;
    link.download = "Course_Template.csv";
    document.body.appendChild(link);
    link.click();

    // 🔹 Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // ✅ Optional: small confirmation
    alert("📥 Course Template downloaded successfully!");
  });
}
