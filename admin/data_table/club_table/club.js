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
const tableBody = document.querySelector("tbody");

// Open modal
openBtn.addEventListener("click", () => {
  document.getElementById("clubId").value = "";
  document.getElementById("clubCode").value = "";
  document.getElementById("clubName").value = "";
  document.getElementById("deptCode").value = "";
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

// Save new club
saveBtn.addEventListener("click", async () => {
  const id = document.getElementById("clubId").value.trim();
  const codeName = document.getElementById("clubCode").value.trim();
  const clubName = document.getElementById("clubName").value.trim();
  const deptCode = document.getElementById("deptCode").value.trim();

  if (!id || !codeName || !clubName || !deptCode) {
    alert("Please fill in all fields.");
    return;
  }

  try {
    const docRef = db.collection("acadClubTable").doc(id);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      alert("Club ID already exists!");
      return;
    }

    const payload = { id, codeName, club: clubName, deptCode };
    await docRef.set(payload);
    addRowToTable(id, codeName, clubName, deptCode);
    modal.style.display = "none";
  } catch (error) {
    console.error("Error saving club:", error);
    alert("Error saving club. Check console.");
  }
});

// Load clubs on page load
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
    const snapshot = await db.collection("acadClubTable").get();
    const docs = snapshot.docs
      .filter(doc => !isNaN(parseInt(doc.id)))
      .sort((a, b) => parseInt(a.id) - parseInt(b.id));

    docs.forEach(doc => {
      const data = doc.data();
      addRowToTable(doc.id, data.codeName, data.club, data.deptCode);
    });
  } catch (error) {
    console.error("Error loading clubs:", error);
  }
});

// Add a row to the table
function addRowToTable(id, codeName, clubName, deptCode) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${id}</td>
    <td>${codeName}</td>
    <td class="club-name">${clubName}</td>
    <td>${deptCode}</td>
    <td>
      <button class="action-btn edit" data-id="${id}"><i class="fas fa-edit"></i></button>
      <button class="action-btn delete" data-id="${id}"><i class="fas fa-trash-alt"></i></button>
    </td>
  `;
  tableBody.appendChild(row);
  row.querySelector(".edit").addEventListener("click", handleEdit);
  row.querySelector(".delete").addEventListener("click", handleDelete);
}

// Reference modals
const editModal = document.getElementById("editModalOverlay");
const editCancelBtn = document.getElementById("editCancelBtn");
const editSaveBtn = document.getElementById("editSaveBtn");

let currentEditId = null;
let currentDeleteId = null;
let currentDeleteRow = null;

async function handleEdit(e) {
  const id = e.currentTarget.dataset.id;
  currentEditId = id;
  const docSnap = await db.collection("acadClubTable").doc(id).get();
  if (!docSnap.exists) return;

  const data = docSnap.data();
  document.getElementById("editClubId").value = data.id || id;
  document.getElementById("editClubCode").value = data.codeName || "";
  document.getElementById("editClubName").value = data.club || "";
  document.getElementById("editDeptCode").value = data.deptCode || "";
  editModal.style.display = "flex";
}

editSaveBtn.addEventListener("click", async () => {
  const codeName = document.getElementById("editClubCode").value.trim();
  const clubName = document.getElementById("editClubName").value.trim();
  const deptCode = document.getElementById("editDeptCode").value.trim();

  if (!codeName || !clubName || !deptCode) {
    alert("Please fill out all fields.");
    return;
  }

  try {
    await db.collection("acadClubTable").doc(currentEditId).update({
      codeName,
      club: clubName,
      deptCode
    });

    const row = document.querySelector(`.edit[data-id="${currentEditId}"]`).closest("tr");
    row.innerHTML = `
      <td>${currentEditId}</td>
      <td>${codeName}</td>
      <td class="club-name">${clubName}</td>
      <td>${deptCode}</td>
      <td>
        <button class="action-btn edit" data-id="${currentEditId}"><i class="fas fa-edit"></i></button>
        <button class="action-btn delete" data-id="${currentEditId}"><i class="fas fa-trash-alt"></i></button>
      </td>
    `;
    row.querySelector(".edit").addEventListener("click", handleEdit);
    row.querySelector(".delete").addEventListener("click", handleDelete);

    editModal.style.display = "none";
    currentEditId = null;
  } catch (error) {
    console.error("Update failed:", error);
    alert("Failed to update club.");
  }
});

editCancelBtn.addEventListener("click", () => {
  editModal.style.display = "none";
  currentEditId = null;
});

const deleteModal = document.getElementById("deleteModalOverlay");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");

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
    await db.collection("acadClubTable").doc(currentDeleteId).delete();
    currentDeleteRow.remove();
    deleteModal.style.display = "none";
    currentDeleteId = null;
  } catch (error) {
    console.error("Error deleting club:", error);
    alert("Delete failed.");
  }
});

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
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    for (const row of jsonData) {
      const id = row["ID no."].toString().trim();
      const codeName = row["Club Code Name"]?.trim();
      const clubName = row["Club Name"]?.trim();
      const deptCode = row["Dept Code Name"]?.trim();

      if (!id || !codeName || !clubName || !deptCode) continue;

      try {
        const docRef = db.collection("acadClubTable").doc(id);
        const docSnap = await docRef.get();
        if (docSnap.exists) continue;

        const payload = { id, codeName, club: clubName, deptCode };
        await docRef.set(payload);
        addRowToTable(id, codeName, clubName, deptCode);
      } catch (error) {
        console.error(`Failed to upload club ${clubName} (ID: ${id}):`, error);
      }
    }

    alert("Upload complete!");
    uploadInput.value = "";
  };
  reader.readAsArrayBuffer(file);
  
}