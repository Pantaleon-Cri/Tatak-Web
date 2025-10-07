// ===== DOM ELEMENTS =====
const openBtn = document.getElementById("openModalBtn");
const modal = document.getElementById("modalOverlay");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.querySelector(".save-btn");
const tableBody = document.querySelector("tbody");

// ===== FIRESTORE COLLECTIONS =====
const clubCollection = db
  .collection("DataTable")
  .doc("Clubs")
  .collection("ClubsDocs");

const officeCollection = db
  .collection("DataTable")
  .doc("Office")
  .collection("OfficeDocs");

// ===== MODAL OPEN / CLOSE =====
openBtn.addEventListener("click", () => {
  document.getElementById("clubId").value = "";
  document.getElementById("clubCode").value = "";
  document.getElementById("clubName").value = "";
  document.getElementById("officeType").value = "";
  modal.style.display = "flex";
});

cancelBtn.addEventListener("click", () => (modal.style.display = "none"));

modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

// ===== FETCH READABLE OFFICE NAME =====
async function getOfficeNameById(id) {
  if (!id) return "—";
  try {
    const docSnap = await officeCollection.doc(id).get();
    if (!docSnap.exists) return id;
    return docSnap.data().office || id;
  } catch (err) {
    console.error("Error fetching office name:", err);
    return id;
  }
}

// ===== SAVE NEW CLUB =====
saveBtn.addEventListener("click", async () => {
  const id = document.getElementById("clubId").value.trim();
  const code = document.getElementById("clubCode").value.trim();
  const clubName = document.getElementById("clubName").value.trim();
  const officeType = document.getElementById("officeType").value.trim();

  if (!id || !code || !clubName || !officeType) {
    alert("Please fill in all fields.");
    return;
  }

  try {
    const docRef = clubCollection.doc(id);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      alert("Club ID already exists!");
      return;
    }

    const payload = { id, code, club: clubName, officeType };
    await docRef.set(payload);

    const officeReadable = await getOfficeNameById(officeType);
    addRowToTable(id, code, clubName, officeReadable);
    modal.style.display = "none";
  } catch (error) {
    console.error("Error saving club:", error);
    alert("Error saving club. Check console.");
  }
});

// ===== LOAD CLUBS ON PAGE LOAD =====
window.addEventListener("DOMContentLoaded", async () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedAdminID = localStorage.getItem("adminID");
  usernameDisplay.textContent = storedAdminID || "Unknown";

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      [
        "userData",
        "studentName",
        "schoolID",
        "studentID",
        "staffID",
        "designeeID",
        "category",
        "office",
        "department",
      ].forEach((key) => localStorage.removeItem(key));
      window.location.href = "../../../logout.html";
    });
  }

  try {
    const snapshot = await clubCollection.get();
    const docs = snapshot.docs
      .filter((doc) => !isNaN(parseInt(doc.id)))
      .sort((a, b) => parseInt(a.id) - parseInt(b.id));

    for (const doc of docs) {
      const data = doc.data();
      const officeReadable = await getOfficeNameById(data.officeType);
      addRowToTable(doc.id, data.code || "", data.club, officeReadable);
    }
  } catch (error) {
    console.error("Error loading clubs:", error);
  }
});

// ===== ADD ROW TO TABLE =====
function addRowToTable(id, code, clubName, officeTypeName) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${id}</td>
    <td>${code}</td>
    <td class="club-name">${clubName}</td>
    <td>${officeTypeName}</td>
    <td>
      <button class="action-btn edit" data-id="${id}">
        <i class="fas fa-edit"></i>
      </button>
      <button class="action-btn delete" data-id="${id}">
        <i class="fas fa-trash-alt"></i>
      </button>
    </td>
  `;
  tableBody.appendChild(row);

  row.querySelector(".edit").addEventListener("click", handleEdit);
  row.querySelector(".delete").addEventListener("click", handleDelete);
}

// ===== EDIT CLUB =====
const editModal = document.getElementById("editModalOverlay");
const editCancelBtn = document.getElementById("editCancelBtn");
const editSaveBtn = document.getElementById("editSaveBtn");

let currentEditId = null;

async function handleEdit(e) {
  const id = e.currentTarget.dataset.id;
  currentEditId = id;

  const docSnap = await clubCollection.doc(id).get();
  if (!docSnap.exists) return;

  const data = docSnap.data();
  document.getElementById("editClubId").value = data.id || id;
  document.getElementById("editClubCode").value = data.code || "";
  document.getElementById("editClubName").value = data.club || "";
  document.getElementById("editOfficeType").value = data.officeType || "";

  editModal.style.display = "flex";
}

editSaveBtn.addEventListener("click", async () => {
  const code = document.getElementById("editClubCode").value.trim();
  const clubName = document.getElementById("editClubName").value.trim();
  const officeType = document.getElementById("editOfficeType").value.trim();

  if (!code || !clubName || !officeType) {
    alert("Please fill out all fields.");
    return;
  }

  try {
    await clubCollection.doc(currentEditId).update({
      code,
      club: clubName,
      officeType,
    });

    const officeReadable = await getOfficeNameById(officeType);

    const row = document
      .querySelector(`.edit[data-id="${currentEditId}"]`)
      .closest("tr");

    row.innerHTML = `
      <td>${currentEditId}</td>
      <td>${code}</td>
      <td class="club-name">${clubName}</td>
      <td>${officeReadable}</td>
      <td>
        <button class="action-btn edit" data-id="${currentEditId}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="action-btn delete" data-id="${currentEditId}">
          <i class="fas fa-trash-alt"></i>
        </button>
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

// ===== DELETE CLUB =====
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
    await clubCollection.doc(currentDeleteId).delete();
    currentDeleteRow.remove();
    deleteModal.style.display = "none";
    currentDeleteId = null;
  } catch (error) {
    console.error("Error deleting club:", error);
    alert("Delete failed.");
  }
});

// ===== UPLOAD FILE =====
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
      const code = row["Club Code Name"]?.trim();
      const clubName = row["Club Name"]?.trim();
      const officeType = row["Office Type"]?.toString().trim();

      if (!id || !code || !clubName || !officeType) continue;

      try {
        const docRef = clubCollection.doc(id);
        const docSnap = await docRef.get();
        if (docSnap.exists) continue;

        const payload = { id, code, club: clubName, officeType };
        await docRef.set(payload);

        const officeReadable = await getOfficeNameById(officeType);
        addRowToTable(id, code, clubName, officeReadable);
      } catch (error) {
        console.error(`Failed to upload club ${clubName} (ID: ${id}):`, error);
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

  const csvContent = "ID no.,Club Code Name,Club Name,Office Type\n";

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "Club_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});