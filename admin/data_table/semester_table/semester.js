// DOM Elements
const openBtn = document.getElementById("openModalBtn");
const modal = document.getElementById("modalOverlay");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");
const semesterIdInput = document.getElementById("semesterId");
const semesterNameInput = document.getElementById("semesterName");
const tableBody = document.querySelector("tbody");

// Firestore path
const semesterRootRef = db.collection("DataTable").doc("Semester").collection("SemesterDocs");

// Open modal
openBtn.addEventListener("click", () => {
  semesterIdInput.value = "";
  semesterNameInput.value = "";
  modal.style.display = "flex";
});

// Cancel modal
cancelBtn.addEventListener("click", () => {
  modal.style.display = "none";
});

// Close modal when clicking outside
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

// Save new semester manually
saveBtn.addEventListener("click", async () => {
  const id = semesterIdInput.value.trim();
  const semesterName = semesterNameInput.value.trim();

  if (!id || !semesterName) {
    alert("All fields are required.");
    return;
  }

  try {
    const docRef = semesterRootRef.doc(id);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      alert("ID already exists.");
      return;
    }

    await docRef.set({
      id,
      semester: semesterName,
      currentSemester: false
    });

    addRowToTable(id, semesterName, false);
    modal.style.display = "none";
  } catch (error) {
    console.error("Error saving semester:", error);
    alert("Error saving semester.");
  }
});

// Load semesters on page load
window.addEventListener("DOMContentLoaded", async () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");
  usernameDisplay.textContent = storedAdminID || "Unknown";

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      [
        "userData", "studentName", "schoolID", "studentID",
        "staffID", "designeeID", "category", "office", "department"
      ].forEach(key => localStorage.removeItem(key));
      window.location.href = "../../../logout.html";
    });
  }

  try {
    const snapshot = await semesterRootRef.get();
    const docs = snapshot.docs.sort((a, b) => parseInt(a.id) - parseInt(b.id));

    for (const doc of docs) {
      const data = doc.data();
      addRowToTable(
        data.id,
        data.semester,
        data.currentSemester || false
      );
    }
  } catch (error) {
    console.error("Error loading semesters:", error);
  }
});

// Add a row to the table
function addRowToTable(id, name, current) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${id}</td>
    <td class="semester-name">${name}</td>
    <td>
      <label class="switch">
        <input type="checkbox" ${current ? "checked" : ""} data-id="${id}" class="current-sem-toggle">
        <span class="slider round"></span>
      </label>
    </td>
    <td>
      <button class="action-btn edit" data-id="${id}"><i class="fas fa-edit"></i></button>
      <button class="action-btn delete" data-id="${id}"><i class="fas fa-trash-alt"></i></button>
    </td>
  `;
  tableBody.appendChild(row);

  // Event Listeners
  row.querySelector(".edit").addEventListener("click", handleEdit);
  row.querySelector(".delete").addEventListener("click", handleDelete);
  row.querySelector(".current-sem-toggle").addEventListener("change", handleCurrentSemester);
}

// Handle current semester toggle
async function handleCurrentSemester(e) {
  const newCurrentId = e.target.dataset.id;
  const isChecked = e.target.checked;
  if (!isChecked) return;

  if (!confirm("Changing the current semester will delete all staff and reset officers/violations/Incomplete of Student. Continue?")) {
    e.target.checked = false;
    return;
  }

  try {
    // 1. Update currentSemester field for all semesters
    const snapshot = await semesterRootRef.get();
    const batch = db.batch();

    snapshot.forEach(doc => {
      const docRef = semesterRootRef.doc(doc.id);
      const isCurrent = doc.id === newCurrentId;
      batch.update(docRef, { currentSemester: isCurrent });
    });

    await batch.commit();

    // 2. Delete all staff
    await deleteAllStaff();

    // 3. Update students: set new semester and clear officers/violations arrays
    const studentsSnap = await db.collection("User").doc("Students").collection("StudentsDocs").get();
    const batchStudents = db.batch();

    studentsSnap.forEach(studentDoc => {
      const studentRef = studentDoc.ref;
      batchStudents.update(studentRef, {
        semester: newCurrentId,    // update semester
        officers: [],               // clear officers array
        violations: [],
        incompletes: []             // clear violations array
      });
    });

    await batchStudents.commit();

    // 4. Update table toggles visually
    document.querySelectorAll(".current-sem-toggle").forEach(toggle => {
      toggle.checked = toggle.dataset.id === newCurrentId;
    });

    alert("Current semester updated successfully.");

  } catch (error) {
    console.error("Error updating current semester:", error);
    alert("Failed to update current semester.");
  }
}

// Delete all staff helper
async function deleteAllStaff() {
  try {
    const staffSnap = await db.collection("staffTable").get();
    if (staffSnap.empty) return;
    const batch = db.batch();
    staffSnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log("All staff deleted due to semester change.");
  } catch (error) {
    console.error("Failed to delete staff:", error);
    alert("Failed to reset staff for new semester.");
  }
}

// Reference modals
const editModal = document.getElementById("editModalOverlay");
const editSemesterIdInput = document.getElementById("editSemesterId");
const editSemesterNameInput = document.getElementById("editSemesterName");
const editCancelBtn = document.getElementById("editCancelBtn");
const editSaveBtn = document.getElementById("editSaveBtn");

const deleteModal = document.getElementById("deleteModalOverlay");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");

let currentEditId = null;
let currentDeleteId = null;
let currentDeleteRow = null;

// Edit handler
function handleEdit(e) {
  const id = e.currentTarget.dataset.id;
  const row = e.currentTarget.closest("tr");
  const name = row.querySelector("td:nth-child(2)").textContent.trim();

  currentEditId = id;
  editSemesterIdInput.value = id;
  editSemesterNameInput.value = name;
  editModal.style.display = "flex";
}

// Save updated semester
editSaveBtn.addEventListener("click", async () => {
  const newName = editSemesterNameInput.value.trim();
  if (!newName) {
    alert("Semester name cannot be empty.");
    return;
  }

  try {
    await semesterRootRef.doc(currentEditId).update({ semester: newName });
    const row = document.querySelector(`.edit[data-id="${currentEditId}"]`).closest("tr");
    row.querySelector("td:nth-child(2)").textContent = newName;
    editModal.style.display = "none";
    currentEditId = null;
  } catch (error) {
    console.error("Error updating semester:", error);
    alert("Update failed.");
  }
});

editCancelBtn.addEventListener("click", () => {
  editModal.style.display = "none";
  currentEditId = null;
});

// Delete handler
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
    await semesterRootRef.doc(currentDeleteId).delete();
    currentDeleteRow.remove();
    deleteModal.style.display = "none";
    currentDeleteId = null;
  } catch (error) {
    console.error("Error deleting semester:", error);
    alert("Delete failed.");
  }
});

// Upload via Excel
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
      const name = row["Semester"]?.trim();
      if (!id || !name) continue;

      try {
        const docRef = semesterRootRef.doc(id);
        const docSnap = await docRef.get();
        if (docSnap.exists) continue;

        await docRef.set({
          id,
          semester: name,
          currentSemester: false
        });

        addRowToTable(id, name, false);
      } catch (error) {
        console.error(`Failed to upload ${name}:`, error);
      }
    }

    alert("Upload complete!");
    uploadInput.value = "";
  };
  reader.readAsArrayBuffer(file);
}

// Download template CSV
const downloadTemplateBtn = document.getElementById("downloadTemplate");

downloadTemplateBtn.addEventListener("click", (e) => {
  e.preventDefault();

  const csvContent = "ID no.,Semester\n";

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "Semester_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

