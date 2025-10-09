// ======================= DOM ELEMENTS =======================
const openBtn = document.getElementById("openModalBtn");
const modal = document.getElementById("modalOverlay");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.querySelector(".save-btn");

const departmentIdInput = document.getElementById("departmentId");
const departmentCodeInput = document.getElementById("departmentCode");
const departmentNameInput = document.getElementById("departmentName");
const tableBody = document.querySelector("tbody");

// ======================= OPEN / CLOSE MODAL =======================
openBtn.addEventListener("click", () => {
  departmentIdInput.value = "";
  departmentCodeInput.value = "";
  departmentNameInput.value = "";
  modal.style.display = "flex";
});

cancelBtn.addEventListener("click", () => {
  modal.style.display = "none";
});

modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

// ======================= SAVE NEW DEPARTMENT =======================
saveBtn.addEventListener("click", async () => {
  const id = departmentIdInput.value.trim();
  const code = departmentCodeInput.value.trim();
  const name = departmentNameInput.value.trim();

  if (!id || !code || !name) {
    alert("All fields are required.");
    return;
  }

  try {
    const docRef = db
      .collection("DataTable")
      .doc("Department")
      .collection("DepartmentDocs")
      .doc(id);

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

// ======================= LOAD DATA ON PAGE LOAD =======================
window.addEventListener("DOMContentLoaded", async () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");

  usernameDisplay.textContent = storedAdminID || "Unknown";

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
    tableBody.innerHTML = "";
    const snapshot = await db
      .collection("DataTable")
      .doc("Department")
      .collection("DepartmentDocs")
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

// ======================= ADD ROW FUNCTION =======================
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

// ======================= EDIT MODAL =======================
const editModal = document.getElementById("editModalOverlay");
const editDepartmentId = document.getElementById("editDepartmentId");
const editDepartmentCode = document.getElementById("editDepartmentCode");
const editDepartmentName = document.getElementById("editDepartmentName");
const editCancelBtn = document.getElementById("editCancelBtn");
const editSaveBtn = document.getElementById("editSaveBtn");

let currentEditId = null;

function handleEdit(e) {
  const id = e.currentTarget.dataset.id;
  const row = e.currentTarget.closest("tr");
  const code = row.querySelector("td:nth-child(2)").textContent.trim();
  const name = row.querySelector("td:nth-child(3)").textContent.trim();

  currentEditId = id;
  editDepartmentId.value = id;
  editDepartmentId.disabled = true;
  editDepartmentCode.value = code;
  editDepartmentName.value = name;

  editModal.style.display = "flex";
}

editSaveBtn.addEventListener("click", async () => {
  const newCode = editDepartmentCode.value.trim();
  const newName = editDepartmentName.value.trim();

  if (!newCode || !newName) {
    alert("Fields cannot be empty.");
    return;
  }

  try {
    await db
      .collection("DataTable")
      .doc("Department")
      .collection("DepartmentDocs")
      .doc(currentEditId)
      .update({
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

// ======================= DELETE MODAL =======================
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
    await db
      .collection("DataTable")
      .doc("Department")
      .collection("DepartmentDocs")
      .doc(currentDeleteId)
      .delete();

    currentDeleteRow.remove();
    deleteModal.style.display = "none";
    currentDeleteId = null;
  } catch (error) {
    console.error("Error deleting department:", error);
    alert("Delete failed.");
  }
});

// ======================= UPLOAD EXCEL FILE =======================
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
        const docRef = db
          .collection("DataTable")
          .doc("Department")
          .collection("DepartmentDocs")
          .doc(id);

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
// ======================= DOWNLOAD DEPARTMENT TEMPLATE =======================
const downloadTemplateBtn = document.getElementById("downloadTemplate");

if (downloadTemplateBtn) {
  downloadTemplateBtn.addEventListener("click", (e) => {
    e.preventDefault();

    // 🔹 CSV header row
    const header = "ID no.,Code Name,Department Name\n";

    // 🔹 Example data row for guidance
    const exampleRow = "1,CED,College of Education\n";

    // 🔹 Combine header + example row
    const csvContent = header + exampleRow;

    // 🔹 Create CSV file as a Blob
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    // 🔹 Create a temporary link to trigger download
    const link = document.createElement("a");
    link.href = url;
    link.download = "Department_Template.csv";
    document.body.appendChild(link);
    link.click();

    // 🔹 Cleanup temporary elements
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert("📥 Department Template downloaded successfully!");
  });
}
