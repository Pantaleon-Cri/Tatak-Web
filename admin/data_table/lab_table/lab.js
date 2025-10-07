// DOM Elements
const openBtn = document.getElementById("openModalBtn");
const modal = document.getElementById("modalOverlay");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.querySelector(".save-btn");
const labIdInput = document.getElementById("labId");
const labInput = document.getElementById("labName");
const tableBody = document.querySelector("tbody");

// Firestore collection reference (UPDATED)
const labCollection = db
  .collection("DataTable")
  .doc("Lab")
  .collection("LabDocs");

// Open modal
openBtn.addEventListener("click", () => {
  labIdInput.value = "";
  labIdInput.disabled = false;
  labInput.value = "";
  modal.style.display = "flex";
});

// Cancel modal
cancelBtn.addEventListener("click", () => {
  modal.style.display = "none";
});

// Close modal when clicking outside
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
  }
});

// Save new lab
saveBtn.addEventListener("click", async () => {
  const id = labIdInput.value.trim();
  const labName = labInput.value.trim();

  if (!id || !labName) {
    alert("Please enter both ID no. and lab name.");
    return;
  }

  try {
    const docRef = labCollection.doc(id);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      alert("Lab ID already exists!");
      return;
    }

    await docRef.set({
      id: id,
      lab: labName,
    });

    addRowToTable(id, labName);
    modal.style.display = "none";
  } catch (error) {
    console.error("Error saving lab:", error);
    alert("Error saving lab. Check console.");
  }
});

// Load lab on page load
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
  } else {
    console.warn("logoutBtn not found");
  }

  try {
    const snapshot = await labCollection.get();
    const docs = snapshot.docs
      .filter((doc) => !isNaN(parseInt(doc.id)))
      .sort((a, b) => parseInt(a.id) - parseInt(b.id));

    docs.forEach((doc) => {
      const data = doc.data();
      addRowToTable(doc.id, data.lab);
    });
  } catch (error) {
    console.error("Error loading lab:", error);
  }
});

// Add a row to the table
function addRowToTable(id, name) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${id}</td>
    <td class="lab-name">${name}</td>
    <td>
      <button class="action-btn edit" data-id="${id}"><i class="fas fa-edit"></i></button>
      <button class="action-btn delete" data-id="${id}"><i class="fas fa-trash-alt"></i></button>
    </td>
  `;
  tableBody.appendChild(row);

  row.querySelector(".edit").addEventListener("click", handleEdit);
  row.querySelector(".delete").addEventListener("click", handleDelete);
}

// ===== EDIT LAB =====
const editModal = document.getElementById("editModalOverlay");
const editlabInput = document.getElementById("editlabName");
const editCancelBtn = document.getElementById("editCancelBtn");
const editSaveBtn = document.getElementById("editSaveBtn");

let currentEditId = null;

async function handleEdit(e) {
  const id = e.currentTarget.dataset.id;
  currentEditId = id;

  const docSnap = await labCollection.doc(id).get();
  if (!docSnap.exists) return;

  const data = docSnap.data();
  editlabInput.value = data.lab || "";

  editModal.style.display = "flex";
}

editSaveBtn.addEventListener("click", async () => {
  const newName = editlabInput.value.trim();
  if (!newName) {
    alert("Lab name cannot be empty.");
    return;
  }

  try {
    await labCollection.doc(currentEditId).update({ lab: newName });

    const row = document
      .querySelector(`.edit[data-id="${currentEditId}"]`)
      .closest("tr");
    row.querySelector("td:nth-child(2)").textContent = newName;

    editModal.style.display = "none";
    currentEditId = null;
  } catch (error) {
    console.error("Error updating lab:", error);
    alert("Update failed.");
  }
});

editCancelBtn.addEventListener("click", () => {
  editModal.style.display = "none";
  currentEditId = null;
});

// ===== DELETE LAB =====
const deleteModal = document.getElementById("deleteModalOverlay");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");

let currentDeleteId = null;
let currentDeleteRow = null;

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
    await labCollection.doc(currentDeleteId).delete();
    currentDeleteRow.remove();
    deleteModal.style.display = "none";
    currentDeleteId = null;
  } catch (error) {
    console.error("Error deleting lab:", error);
    alert("Delete failed.");
  }
});

// ===== UPLOAD lab FROM EXCEL =====
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
      const labName = row["Laboratories"]?.trim();
      if (!id || !labName) continue;

      try {
        const docRef = labCollection.doc(id);
        const docSnap = await docRef.get();
        if (docSnap.exists) continue;

        await docRef.set({ id, lab: labName });
        addRowToTable(id, labName);
      } catch (error) {
        console.error(`Failed to upload ${labName} (ID: ${id}):`, error);
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

  const csvContent = "ID no.,Laboratories\n";

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "Lab_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});