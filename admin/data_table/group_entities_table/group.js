const uploadBtn = document.getElementById("uploadBtn");
const uploadInput = document.getElementById("uploadInput");
const tableBody = document.querySelector("tbody");

// Open file input
uploadBtn.addEventListener("click", () => uploadInput.click());
uploadInput.addEventListener("change", handleFileUpload);

// Handle Excel Upload
async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (event) {
    const data = new Uint8Array(event.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    try {
      const headers = jsonData[0];
      const idIndex = headers.indexOf("ID no.");
      const typeIndex = headers.indexOf("Club Type");
      const nameIndex = headers.indexOf("Club Name");

      if (idIndex === -1 || typeIndex === -1 || nameIndex === -1) {
        alert("Headers must be: ID no., Club Type, Club Name");
        return;
      }

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        const id = row[idIndex]?.toString().trim();
        const clubType = row[typeIndex]?.trim();
        const club = row[nameIndex]?.trim();

        if (!id || !clubType || !club) continue;

        await db.collection("groupTable").doc(id).set({ id, clubType, club });
        addRowToTable(id, clubType, club);
      }

      alert("Upload complete!");
      uploadInput.value = "";
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. See console.");
    }
  };
  reader.readAsArrayBuffer(file);
}

// Add row to HTML table
function addRowToTable(id, clubType, clubName) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${id}</td>
    <td>${clubType}</td>
    <td>${clubName}</td>
    <td>
      <button class="action-btn edit" data-id="${id}"><i class="fas fa-edit"></i></button>
      <button class="action-btn delete" data-id="${id}"><i class="fas fa-trash-alt"></i></button>
    </td>
  `;
  tableBody.appendChild(row);

  row.querySelector(".edit").addEventListener("click", handleEdit);
  row.querySelector(".delete").addEventListener("click", handleDelete);
}

// ===== Add Club (Modal Save)
const saveBtn = document.getElementById("saveClubBtn");
const modalOverlay = document.getElementById("modalOverlay");

saveBtn.addEventListener("click", async () => {
  const id = document.getElementById("newClubId").value.trim();
  const clubType = document.getElementById("newClubType").value.trim();
  const club = document.getElementById("newClubName").value.trim();

  if (!id || !clubType || !club) {
    alert("All fields are required.");
    return;
  }

  try {
    await db.collection("groupTable").doc(id).set({ id, clubType, club });
    addRowToTable(id, clubType, club);
    modalOverlay.style.display = "none";
    document.getElementById("newClubId").value = "";
    document.getElementById("newClubType").value = "";
    document.getElementById("newClubName").value = "";
  } catch (error) {
    console.error("Error saving club:", error);
    alert("Failed to save.");
  }
});

document.getElementById("cancelBtn").addEventListener("click", () => {
  modalOverlay.style.display = "none";
});

// ===== Edit Club
const editModal = document.getElementById("editModalOverlay");
const editIdInput = document.getElementById("editClubId");
const editTypeInput = document.getElementById("editClubType");
const editNameInput = document.getElementById("editClubName");
const editCancelBtn = document.getElementById("editCancelBtn");
const editSaveBtn = document.getElementById("editSaveBtn");

let currentEditId = null;

function handleEdit(e) {
  currentEditId = e.currentTarget.dataset.id;
  const row = e.currentTarget.closest("tr");
  editIdInput.value = row.children[0].textContent;
  editTypeInput.value = row.children[1].textContent;
  editNameInput.value = row.children[2].textContent;
  editModal.style.display = "flex";
}

editSaveBtn.addEventListener("click", async () => {
  const updatedName = editNameInput.value.trim();
  if (!updatedName) {
    alert("Club name cannot be empty.");
    return;
  }

  try {
    await db.collection("groupTable").doc(currentEditId).update({ club: updatedName });
    const row = document.querySelector(`.edit[data-id="${currentEditId}"]`).closest("tr");
    row.children[2].textContent = updatedName;
    editModal.style.display = "none";
    currentEditId = null;
  } catch (error) {
    console.error("Error updating club name:", error);
    alert("Update failed.");
  }
});

editCancelBtn.addEventListener("click", () => {
  editModal.style.display = "none";
  currentEditId = null;
});

// ===== Delete Club
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
    await db.collection("groupTable").doc(currentDeleteId).delete();
    currentDeleteRow.remove();
    deleteModal.style.display = "none";
    currentDeleteId = null;
  } catch (error) {
    console.error("Error deleting club:", error);
    alert("Delete failed.");
  }
});

// ===== Load Clubs on Page Load
async function loadClubsFromFirestore() {
  try {
    const snapshot = await db.collection("groupTable").orderBy("id").get();
    snapshot.forEach(doc => {
      const data = doc.data();
      addRowToTable(data.id, data.clubType, data.club);
    });
  } catch (error) {
    console.error("Error loading clubs from Firestore:", error);
  }
}

window.addEventListener("DOMContentLoaded", function () {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");

  if (storedAdminID) {
    usernameDisplay.textContent = storedAdminID;  // show saved ID
  } else {
    usernameDisplay.textContent = "Unknown"; // fallback
  }
  loadClubsFromFirestore(); // Load clubs when page opens

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
});
