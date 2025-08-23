
// DOM Elements
const openBtn = document.getElementById("openModalBtn");
const modal = document.getElementById("modalOverlay");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.querySelector(".save-btn");

const departmentIdInput = document.getElementById("departmentId");
const departmentCodeInput = document.getElementById("departmentCode");
const departmentNameInput = document.getElementById("departmentName");
const tableBody = document.querySelector("tbody");

// Open modal
openBtn.addEventListener("click", () => {
  departmentIdInput.value = "";
  departmentCodeInput.value = "";
  departmentNameInput.value = "";
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

// Save new department
saveBtn.addEventListener("click", async () => {
  const id = departmentIdInput.value.trim();
  const code = departmentCodeInput.value.trim();
  const name = departmentNameInput.value.trim();

  if (!id || !code || !name) {
    alert("All fields are required.");
    return;
  }

  try {
    const docRef = db.collection("departmentTable").doc(id);
    const docSnapshot = await docRef.get();

    if (docSnapshot.exists) {
      alert("Department ID already exists.");
      return;
    }

    await docRef.set({ id, code, department: name });
    addRowToTable(id, code, name);
    modal.style.display = "none";
  } catch (error) {
    console.error("Error saving department:", error);
    alert("Error saving department.");
  }
});

// Load departments on page load
window.addEventListener("DOMContentLoaded", async () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");

  if (storedAdminID) {
    usernameDisplay.textContent = storedAdminID;  // show saved ID
  } else {
    usernameDisplay.textContent = "Unknown"; // fallback
  }
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
    tableBody.innerHTML = ""; // Clear previous
    const snapshot = await db.collection("departmentTable")
      .orderBy(firebase.firestore.FieldPath.documentId())
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      const id = data.id || doc.id;
      addRowToTable(id, data.code, data.department);
    });
  } catch (error) {
    console.error("Error loading departments:", error);
  }
});

// Add row to table
function addRowToTable(id, code, name) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${id}</td>
    <td>${code}</td>
    <td class="department-name">${name}</td>
    <td>
      <button class="action-btn edit" data-id="${id}"><i class="fas fa-edit"></i></button>
      <button class="action-btn delete" data-id="${id}"><i class="fas fa-trash-alt"></i></button>
    </td>
  `;
  tableBody.appendChild(row);

  row.querySelector(".edit").addEventListener("click", handleEdit);
  row.querySelector(".delete").addEventListener("click", handleDelete);
}

// Edit Modal
const editModal = document.getElementById("editModalOverlay");
const editDepartmentId = document.getElementById("editDepartmentId");
const editDepartmentCode = document.getElementById("editDepartmentCode");
const editDepartmentName = document.getElementById("editDepartmentName");
const editCancelBtn = document.getElementById("editCancelBtn");
const editSaveBtn = document.getElementById("editSaveBtn");

let currentEditId = null;

// Handle Edit
function handleEdit(e) {
  const id = e.currentTarget.dataset.id;
  const row = e.currentTarget.closest("tr");
  const code = row.querySelector("td:nth-child(2)").textContent.trim();
  const name = row.querySelector("td:nth-child(3)").textContent.trim();

  currentEditId = id;
  editDepartmentId.value = id;
  editDepartmentId.disabled = true; // Prevent changing ID
  editDepartmentCode.value = code;
  editDepartmentName.value = name;

  editModal.style.display = "flex";
}

// Save edit
editSaveBtn.addEventListener("click", async () => {
  const newCode = editDepartmentCode.value.trim();
  const newName = editDepartmentName.value.trim();

  if (!newCode || !newName) {
    alert("Fields cannot be empty.");
    return;
  }

  try {
    await db.collection("departmentTable").doc(currentEditId).update({
      code: newCode,
      department: newName
    });

    const row = document.querySelector(`.edit[data-id="${currentEditId}"]`).closest("tr");
    row.querySelector("td:nth-child(2)").textContent = newCode;
    row.querySelector("td:nth-child(3)").textContent = newName;

    editModal.style.display = "none";
    currentEditId = null;
  } catch (error) {
    console.error("Error updating department:", error);
    alert("Update failed.");
  }
});

editCancelBtn.addEventListener("click", () => {
  editModal.style.display = "none";
  currentEditId = null;
});

// Delete modal
const deleteModal = document.getElementById("deleteModalOverlay");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");

let currentDeleteId = null;
let currentDeleteRow = null;

// Handle delete
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
    await db.collection("departmentTable").doc(currentDeleteId).delete();
    currentDeleteRow.remove();
    deleteModal.style.display = "none";
    currentDeleteId = null;
  } catch (error) {
    console.error("Error deleting department:", error);
    alert("Delete failed.");
  }
});

// Upload File
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
      const code = row["Dept Code Name"]?.trim();
      const name = row["Department Name"]?.trim();
      if (!id || !code || !name) continue;

      try {
        const docRef = db.collection("departmentTable").doc(id);
        const docSnap = await docRef.get();
        if (docSnap.exists) continue;

        await docRef.set({ id, code, department: name });
        addRowToTable(id, code, name);
      } catch (error) {
        console.error(`Failed to upload ${name}:`, error);
      }
    }

    alert("Upload complete!");
    uploadInput.value = "";
  };
  reader.readAsArrayBuffer(file);
}
