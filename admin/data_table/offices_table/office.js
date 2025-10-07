// DOM Elements
const openBtn = document.getElementById("openModalBtn");
const modal = document.getElementById("modalOverlay");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveOfficeBtn");
const officeIdInput = document.getElementById("officeId");
const officeInput = document.getElementById("officeName");
const tableBody = document.querySelector("tbody");

// Firestore reference
const officeCollection = db
  .collection("DataTable")
  .doc("Office")
  .collection("OfficeDocs");

// Open modal
openBtn.addEventListener("click", () => {
  officeIdInput.value = "";
  officeInput.value = "";
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

// Save new office (manual ID)
saveBtn.addEventListener("click", async () => {
  const id = officeIdInput.value.trim();
  const officeName = officeInput.value.trim();

  if (!id || !officeName) {
    alert("Please enter both ID and office name.");
    return;
  }

  try {
    await officeCollection.doc(id).set({
      id: id,
      office: officeName
    });

    addRowToTable(id, officeName);
    modal.style.display = "none";
  } catch (error) {
    console.error("Error saving office:", error);
    alert("Error saving office. Check console.");
  }
});

// Load offices on page load
window.addEventListener("DOMContentLoaded", async () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");

  if (storedAdminID) usernameDisplay.textContent = storedAdminID;
  else usernameDisplay.textContent = "Unknown";

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
  }

  try {
    const snapshot = await officeCollection.get();
    const docs = snapshot.docs
      .filter(doc => !isNaN(parseInt(doc.id)))
      .sort((a, b) => parseInt(a.id) - parseInt(b.id));

    docs.forEach(doc => {
      const data = doc.data();
      addRowToTable(data.id, data.office);
    });
  } catch (error) {
    console.error("Error loading offices:", error);
  }
});

// Add a row to the table
function addRowToTable(id, name) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${id}</td>
    <td class="office-name">${name}</td>
    <td>
      <button class="action-btn edit" data-id="${id}"><i class="fas fa-edit"></i></button>
      <button class="action-btn delete" data-id="${id}"><i class="fas fa-trash-alt"></i></button>
    </td>
  `;
  tableBody.appendChild(row);

  row.querySelector(".edit").addEventListener("click", handleEdit);
  row.querySelector(".delete").addEventListener("click", handleDelete);
}

// Modals
const editModal = document.getElementById("editModalOverlay");
const editOfficeInput = document.getElementById("editOfficeName");
const editCancelBtn = document.getElementById("editCancelBtn");
const editSaveBtn = document.getElementById("editSaveBtn");

const deleteModal = document.getElementById("deleteModalOverlay");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");

let currentEditId = null;
let currentDeleteId = null;
let currentDeleteRow = null;

// Handle Edit Icon Click
function handleEdit(e) {
  const id = e.currentTarget.dataset.id;
  const row = e.currentTarget.closest("tr");
  const nameCell = row.querySelector("td:nth-child(2)");
  currentEditId = id;

  editOfficeInput.value = nameCell.textContent.trim();
  editModal.style.display = "flex";
}

// Save Edit
editSaveBtn.addEventListener("click", async () => {
  const newName = editOfficeInput.value.trim();
  if (!newName) {
    alert("Office name cannot be empty.");
    return;
  }

  try {
    await officeCollection.doc(currentEditId).update({ office: newName });
    const row = document.querySelector(`.edit[data-id="${currentEditId}"]`).closest("tr");
    row.querySelector("td:nth-child(2)").textContent = newName;
    editModal.style.display = "none";
    currentEditId = null;
  } catch (error) {
    console.error("Error updating office:", error);
    alert("Update failed.");
  }
});

editCancelBtn.addEventListener("click", () => {
  editModal.style.display = "none";
  currentEditId = null;
});

// Handle Delete Icon Click
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
    await officeCollection.doc(currentDeleteId).delete();
    currentDeleteRow.remove();
    deleteModal.style.display = "none";
    currentDeleteId = null;
  } catch (error) {
    console.error("Error deleting office:", error);
    alert("Delete failed.");
  }
});

// Upload
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
      const officeName = row["Office"]?.trim(); // ✅ corrected column name
      if (!id || !officeName) continue;

      try {
        await officeCollection.doc(id).set({
          id: id,
          office: officeName
        });
        addRowToTable(id, officeName);
      } catch (error) {
        console.error(`Failed to upload ${officeName} (ID: ${id}):`, error);
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

  const csvContent = "ID no.,Office\n";

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "Office_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});