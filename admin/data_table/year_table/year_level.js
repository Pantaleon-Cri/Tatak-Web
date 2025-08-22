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
const saveBtn = document.querySelector(".save-btn");
const idInput = document.getElementById("yearLevelId");
const yearInput = document.getElementById("yearLevelName");
const tableBody = document.querySelector("tbody");

// Open modal
openBtn.addEventListener("click", () => {
  idInput.value = "";
  yearInput.value = "";
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

// Save new year level
saveBtn.addEventListener("click", async () => {
  const yearLevelId = idInput.value.trim();
  const yearLevelName = yearInput.value.trim();

  if (!yearLevelId || !yearLevelName) {
    alert("Please enter both ID and year level name.");
    return;
  }

  try {
    const docRef = db.collection("yearLevelTable").doc(yearLevelId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      alert("ID already exists. Please use a unique ID.");
      return;
    }

    await docRef.set({
      id: yearLevelId,
      yearLevel: yearLevelName
    });

    addRowToTable(yearLevelId, yearLevelName);
    modal.style.display = "none";
  } catch (error) {
    console.error("Error saving year level:", error);
    alert("Error saving year level. Check console.");
  }
});

// Load year levels on page load
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
    const snapshot = await db.collection("yearLevelTable").get();
    const docs = snapshot.docs
      .filter(doc => !isNaN(parseInt(doc.id)))
      .sort((a, b) => parseInt(a.id) - parseInt(b.id));

    docs.forEach(doc => {
      const data = doc.data();
      addRowToTable(doc.id, data.yearLevel);
    });
  } catch (error) {
    console.error("Error loading year levels:", error);
  }
});

// Add a row to the table
function addRowToTable(id, name) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${id}</td>
    <td class="year-level-name">${name}</td>
    <td>
      <button class="action-btn edit" data-id="${id}"><i class="fas fa-edit"></i></button>
      <button class="action-btn delete" data-id="${id}"><i class="fas fa-trash-alt"></i></button>
    </td>
  `;
  tableBody.appendChild(row);

  // Event Listeners
  row.querySelector(".edit").addEventListener("click", handleEdit);
  row.querySelector(".delete").addEventListener("click", handleDelete);
}

// Reference modals
const editModal = document.getElementById("editModalOverlay");
const editYearLevelInput = document.getElementById("editYearLevelName");
const editCancelBtn = document.getElementById("editCancelBtn");
const editSaveBtn = document.getElementById("editSaveBtn");

const deleteModal = document.getElementById("deleteModalOverlay");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");

let currentEditId = null;
let currentDeleteId = null;
let currentDeleteRow = null;

// Handle Edit
async function handleEdit(e) {
  const id = e.currentTarget.dataset.id;
  const row = e.currentTarget.closest("tr");
  const nameCell = row.querySelector("td:nth-child(2)");
  currentEditId = id;

  editYearLevelInput.value = nameCell.textContent.trim();
  editModal.style.display = "flex";
}

// Save Edit
editSaveBtn.addEventListener("click", async () => {
  const newName = editYearLevelInput.value.trim();
  if (!newName) {
    alert("Year level name cannot be empty.");
    return;
  }

  try {
    await db.collection("yearLevelTable").doc(currentEditId).update({ yearLevel: newName });
    const row = document.querySelector(`.edit[data-id="${currentEditId}"]`).closest("tr");
    row.querySelector("td:nth-child(2)").textContent = newName;
    editModal.style.display = "none";
    currentEditId = null;
  } catch (error) {
    console.error("Error updating year level:", error);
    alert("Update failed.");
  }
});

editCancelBtn.addEventListener("click", () => {
  editModal.style.display = "none";
  currentEditId = null;
});

// Delete
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
    await db.collection("yearLevelTable").doc(currentDeleteId).delete();
    currentDeleteRow.remove();
    deleteModal.style.display = "none";
    currentDeleteId = null;
  } catch (error) {
    console.error("Error deleting year level:", error);
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
      const yearLevelName = row["Year Level"]?.trim();

      if (!id || !yearLevelName) continue;

      try {
        const docRef = db.collection("yearLevelTable").doc(id);
        const docSnap = await docRef.get();
        if (docSnap.exists) continue;

        await docRef.set({
          id: id,
          yearLevel: yearLevelName
        });

        addRowToTable(id, yearLevelName);
      } catch (error) {
        console.error(`Failed to upload ${yearLevelName}:`, error);
      }
    }

    alert("Upload complete!");
    uploadInput.value = "";
  };
  reader.readAsArrayBuffer(file);
}
