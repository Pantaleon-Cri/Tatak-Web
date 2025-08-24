// ✅ Staff CRUD Logic
async function saveNewStaff() {
  const id = document.getElementById("staffId").value.trim();
  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const email = document.getElementById("institutionalEmail").value.trim();
  const password = document.getElementById("generatedPassword").value.trim();

  if (!id || !firstName || !lastName || !email || !password) {
    alert("Please fill in all fields and generate a password.");
    return;
  }

  try {
    const designeeId = JSON.parse(localStorage.getItem("userData")).id;
    const designeeDoc = await db.collection("Designees").doc(designeeId).get();
    if (!designeeDoc.exists) return alert("Designee record not found.");

    const d = designeeDoc.data();
    userOffice = d.office || "";
    userCategory = d.category || "";
    userDepartment = d.department || "";

    // ✅ Check duplicate by staff ID + office + category + department
    const existing = await db
      .collection("staffTable")
      .where("id", "==", id)
      .where("office", "==", userOffice)
      .where("category", "==", userCategory)
      .where("department", "==", userDepartment)
      .get();

    if (!existing.empty) return alert("Staff with this ID already exists.");

    // ✅ Add staff with Firestore auto-generated ID
    await db.collection("staffTable").add({
      id,
      firstName,
      lastName,
      email,
      password,
      category: userCategory,
      department: userDepartment,
      office: userOffice,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdByDesigneeID: designeeId,
    });

    alert("Staff added successfully!");
    closeModal("modalOverlay");
    clearModalInputs();
    await loadAllStaff();
  } catch (err) {
    console.error(err);
    alert("Error saving staff.");
  }
}

async function getDesigneeInfoAndLoadStaff(userId) {
  const doc = await db.collection("Designees").doc(userId).get();
  if (!doc.exists) return;
  const d = doc.data();
  userOffice = d.office || "";
  userCategory = d.category || "";
  userDepartment = d.department || "";
  await loadAllStaff();
}

async function loadAllStaff() {
  const snapshot = await db
    .collection("staffTable")
    .where("office", "==", userOffice)
    .where("category", "==", userCategory)
    .where("department", "==", userDepartment)
    .orderBy("createdAt", "desc")
    .get();

  const tbody = document.querySelector("tbody");
  tbody.innerHTML = "";
  snapshot.forEach((doc) => addRowToTable(doc.data()));
}

function addRowToTable(data) {
  const tbody = document.querySelector("tbody");
  const row = document.createElement("tr");
  let actionButtons = "";
  if (currentUserRole === "designee") {
    actionButtons = `
      <button class="action-btn edit" onclick="editStaff('${data.id}')"><i class="fas fa-edit"></i></button>
      <button class="action-btn delete" onclick="deleteStaff('${data.id}', this)"><i class="fas fa-trash"></i></button>
    `;
  }
  row.innerHTML = `
    <td>${data.id}</td>
    <td>${data.firstName}</td>
    <td>${data.lastName}</td>
    <td>${data.email}</td>
    <td>${data.password}</td>
    <td>${actionButtons}</td>
  `;
  tbody.appendChild(row);
}

// Global variables to track which staff is being edited/deleted
let selectedStaffId = null;

// ✅ Open Edit Modal and populate fields
function editStaff(staffId) {
  selectedStaffId = staffId;

  const tbody = document.querySelector("tbody");
  const row = Array.from(tbody.rows).find(
    (r) => r.cells[0].innerText === staffId
  );
  if (!row) return;

  document.getElementById("editStaffId").value = row.cells[0].innerText;
  document.getElementById("editFirstName").value = row.cells[1].innerText;
  document.getElementById("editLastName").value = row.cells[2].innerText;
  document.getElementById("editEmail").value = row.cells[3].innerText;
  document.getElementById("editPassword").value = row.cells[4].innerText;

  document.getElementById("editModalOverlay").style.display = "flex";
}

// ✅ Close Edit Modal
document.getElementById("editCancelBtn").addEventListener("click", () => {
  document.getElementById("editModalOverlay").style.display = "none";
});

// ✅ Save Edited Staff
document.getElementById("editSaveBtn").addEventListener("click", async () => {
  if (!selectedStaffId) return;

  const firstName = document.getElementById("editFirstName").value.trim();
  const lastName = document.getElementById("editLastName").value.trim();
  const email = document.getElementById("editEmail").value.trim();
  const password = document.getElementById("editPassword").value.trim();

  if (!firstName || !lastName || !email || !password) {
    return alert("Please fill in all fields.");
  }

  try {
    // Find the document by staffId (manual field)
    const snapshot = await db
      .collection("staffTable")
      .where("id", "==", selectedStaffId)
      .get();
    if (snapshot.empty) return alert("Staff not found.");

    const docId = snapshot.docs[0].id;

    await db.collection("staffTable").doc(docId).update({
      firstName,
      lastName,
      email,
      password,
    });

    alert("Staff updated successfully!");
    document.getElementById("editModalOverlay").style.display = "none";
    await loadAllStaff(); // Refresh table
  } catch (err) {
    console.error(err);
    alert("Error updating staff.");
  }
});

// ✅ Open Delete Modal
function deleteStaff(staffId) {
  selectedStaffId = staffId;
  document.getElementById("deleteModalOverlay").style.display = "flex";
}

// ✅ Cancel Delete
document.getElementById("deleteCancelBtn").addEventListener("click", () => {
  selectedStaffId = null;
  document.getElementById("deleteModalOverlay").style.display = "none";
});

// ✅ Confirm Delete
document.getElementById("deleteConfirmBtn").addEventListener("click", async () => {
  if (!selectedStaffId) return;

  try {
    const snapshot = await db
      .collection("staffTable")
      .where("id", "==", selectedStaffId)
      .get();
    if (snapshot.empty) return alert("Staff not found.");

    const docId = snapshot.docs[0].id;
    await db.collection("staffTable").doc(docId).delete();

    alert("Staff deleted successfully!");
    document.getElementById("deleteModalOverlay").style.display = "none";
    await loadAllStaff(); // Refresh table
  } catch (err) {
    console.error(err);
    alert("Error deleting staff.");
  }
});
