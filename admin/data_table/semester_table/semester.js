// Firebase Configuration (v8)
var firebaseConfig = {
  apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
  authDomain: "tatak-mobile-web.firebaseapp.com",
  projectId: "tatak-mobile-web",
  storageBucket: "tatak-mobile-web.firebasestorage.app",
  messagingSenderId: "771908675869",
  appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
  measurementId: "G-CENPP29LKQ"
};
firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();

// DOM Elements
const openBtn = document.getElementById("openModalBtn");
const modal = document.getElementById("modalOverlay");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");
const semesterIdInput = document.getElementById("semesterId");
const semesterNameInput = document.getElementById("semesterName");
const tableBody = document.querySelector("tbody");

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

// Close modal on outside click
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
  }
});

// Save new semester (manual ID)
saveBtn.addEventListener("click", async () => {
  const id = semesterIdInput.value.trim();
  const semesterName = semesterNameInput.value.trim();

  if (!id || !semesterName) {
    alert("All fields are required.");
    return;
  }

  try {
    const docRef = db.collection("semesterTable").doc(id);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      alert("ID already exists.");
      return;
    }

    await docRef.set({ id, semester: semesterName, visibleToStudents: false });
    addRowToTable(id, semesterName, false);
    modal.style.display = "none";
  } catch (error) {
    console.error("Error saving semester:", error);
    alert("Error saving semester.");
  }
});

// Load semesters on page load
window.addEventListener("DOMContentLoaded", async () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
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
        "department"
      ];

      keysToRemove.forEach(key => localStorage.removeItem(key));

      window.location.href = "../../../logout.html";
    });
  } else {
    console.warn("logoutBtn not found");
  }
  try {
    const snapshot = await db.collection("semesterTable").get();
    const docs = snapshot.docs
      .filter(doc => !isNaN(parseInt(doc.id)))
      .sort((a, b) => parseInt(a.id) - parseInt(b.id));

    docs.forEach(doc => {
      const data = doc.data();
      addRowToTable(doc.id, data.semester, data.visibleToStudents || false);
    });
  } catch (error) {
    console.error("Error loading semesters:", error);
  }
});

// Add row to table
function addRowToTable(id, name, visible) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${id}</td>
    <td class="semester-name">${name}</td>
    <td>
      <label class="switch">
        <input type="checkbox" ${visible ? "checked" : ""} data-id="${id}" class="visibility-toggle">
        <span class="slider round"></span>
      </label>
    </td>
    <td>
      <button class="action-btn edit" data-id="${id}"><i class="fas fa-edit"></i></button>
      <button class="action-btn delete" data-id="${id}"><i class="fas fa-trash-alt"></i></button>
    </td>
  `;
  tableBody.appendChild(row);

  // Event listeners
  row.querySelector(".edit").addEventListener("click", handleEdit);
  row.querySelector(".delete").addEventListener("click", handleDelete);
  row.querySelector(".visibility-toggle").addEventListener("change", handleToggleVisibility);
}

// Handle visibility toggle
async function handleToggleVisibility(e) {
  const id = e.target.dataset.id;
  const isVisible = e.target.checked;
  try {
    await db.collection("semesterTable").doc(id).update({
      visibleToStudents: isVisible
    });
    console.log(`Semester ${id} visibility set to ${isVisible}`);
  } catch (error) {
    console.error("Error updating visibility:", error);
    alert("Failed to update visibility.");
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
    await db.collection("semesterTable").doc(currentEditId).update({
      semester: newName,
    });

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
    await db.collection("semesterTable").doc(currentDeleteId).delete();
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
        const docRef = db.collection("semesterTable").doc(id);
        const docSnap = await docRef.get();
        if (docSnap.exists) continue;

        await docRef.set({ id, semester: name, visibleToStudents: false });
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
