// ✅ Staff CRUD Logic for /User/Designees/StaffDocs with role: "Staff"

// Use window-scoped globals to avoid duplicate declarations
window.userOffice = window.userOffice || "";
window.userCategory = window.userCategory || "";
window.userDepartment = window.userDepartment || "";
window.currentUserRole = window.currentUserRole || "designee";
window.selectedStaffId = window.selectedStaffId || null;

// Helper to generate staffDocId without double dashes
function generateStaffDocId(id, office, department, category) {
  return [id, office, department, category].filter(Boolean).join("-");
}

// -----------------------
// Save New Staff
window.saveNewStaff = async function() {
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
    // Get logged-in designee info
    const designeeData = JSON.parse(localStorage.getItem("userData"));
    const designeeId = designeeData.id;

    const designeeDoc = await db.collection("User").doc("Designees")
      .collection("DesigneesDocs").doc(designeeId).get();
    if (!designeeDoc.exists) return alert("Designee record not found.");

    const d = designeeDoc.data();
    window.userOffice = d.office || "";
    window.userCategory = d.category || "";
    window.userDepartment = d.department || "";

    // Create staffDocId
    const staffDocId = generateStaffDocId(id, window.userOffice, window.userDepartment, window.userCategory);

    // Check if document already exists
    const existing = await db.collection("User").doc("Designees")
      .collection("StaffDocs").doc(staffDocId).get();
    if (existing.exists) return alert("Staff with this ID already exists.");

    // Add new staff
    await db.collection("User").doc("Designees")
      .collection("StaffDocs").doc(staffDocId).set({
        id,
        firstName,
        lastName,
        email,
        password,
        office: window.userOffice,
        category: window.userCategory,
        department: window.userDepartment,
        role: "Staff",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdByDesigneeID: designeeId
      });

    alert("Staff added successfully!");
    closeModal("modalOverlay");
    clearModalInputs();
    await loadAllStaff();

  } catch (err) {
    console.error(err);
    alert("Error saving staff.");
  }
};

// -----------------------
// Load all staff for current designee
async function loadAllStaff() {
  const snapshot = await db.collection("User").doc("Designees")
    .collection("StaffDocs")
    .where("office", "==", window.userOffice)
    .where("category", "==", window.userCategory)
    .where("department", "==", window.userDepartment)
    .where("role", "==", "Staff")
    .orderBy("createdAt", "desc")
    .get();

  const tbody = document.querySelector("tbody");
  tbody.innerHTML = "";
  snapshot.forEach(doc => addRowToTable(doc.data()));
}

// -----------------------
// Add staff row to table
function addRowToTable(data) {
  const tbody = document.querySelector("tbody");
  const row = document.createElement("tr");

  let actionButtons = "";
  if (window.currentUserRole === "designee") {
    actionButtons = `
      <button class="action-btn edit" onclick="editStaff('${data.id}')"><i class="fas fa-edit"></i></button>
      <button class="action-btn delete" onclick="deleteStaff('${data.id}')"><i class="fas fa-trash"></i></button>
    `;
  }

  // 🔹 Password toggle: masked by default
  const passwordId = `pw-${data.id}`;
  const passwordHTML = `
    <span id="${passwordId}" class="masked-password">••••••</span>
    <button type="button" class="toggle-pw-btn" onclick="togglePassword('${passwordId}', '${data.password}')">
  <i class="fas fa-eye"></i>
</button>

  `;

  row.innerHTML = `
    <td>${data.id}</td>
    <td>${data.firstName}</td>
    <td>${data.lastName}</td>
    <td>${data.email}</td>
    <td>${passwordHTML}</td>
    <td>${actionButtons}</td>
  `;

  tbody.appendChild(row);
}

// -----------------------
// Toggle password visibility
function togglePassword(spanId, password) {
  const span = document.getElementById(spanId);
  if (!span) return;

  if (span.textContent === "••••••") {
    span.textContent = password;
  } else {
    span.textContent = "••••••";
  }
}

// -----------------------
// Open Edit Modal
function editStaff(staffId) {
  window.selectedStaffId = staffId;
  const tbody = document.querySelector("tbody");
  const row = Array.from(tbody.rows).find(r => r.cells[0].innerText === staffId);
  if (!row) return;

  document.getElementById("editStaffId").value = row.cells[0].innerText;
  document.getElementById("editFirstName").value = row.cells[1].innerText;
  document.getElementById("editLastName").value = row.cells[2].innerText;
  document.getElementById("editEmail").value = row.cells[3].innerText;
  document.getElementById("editPassword").value = row.cells[4].querySelector("span").textContent;

  document.getElementById("editModalOverlay").style.display = "flex";
}

// Close Edit Modal
document.getElementById("editCancelBtn").addEventListener("click", () => {
  document.getElementById("editModalOverlay").style.display = "none";
});

// -----------------------
// Save Edited Staff
document.getElementById("editSaveBtn").addEventListener("click", async () => {
  if (!window.selectedStaffId) return;

  const firstName = document.getElementById("editFirstName").value.trim();
  const lastName = document.getElementById("editLastName").value.trim();
  const email = document.getElementById("editEmail").value.trim();
  const password = document.getElementById("editPassword").value.trim();

  if (!firstName || !lastName || !email || !password) {
    return alert("Please fill in all fields.");
  }

  try {
    const staffDocId = generateStaffDocId(window.selectedStaffId, window.userOffice, window.userDepartment, window.userCategory);

    const docRef = db.collection("User").doc("Designees")
      .collection("StaffDocs").doc(staffDocId);

    const docSnap = await docRef.get();
    if (!docSnap.exists) return alert("Staff not found.");

    await docRef.update({
      firstName,
      lastName,
      email,
      password
    });

    alert("Staff updated successfully!");
    document.getElementById("editModalOverlay").style.display = "none";
    await loadAllStaff();

  } catch (err) {
    console.error(err);
    alert("Error updating staff.");
  }
});

// -----------------------
// Delete Staff
function deleteStaff(staffId) {
  window.selectedStaffId = staffId;
  document.getElementById("deleteModalOverlay").style.display = "flex";
}

// Cancel Delete
document.getElementById("deleteCancelBtn").addEventListener("click", () => {
  window.selectedStaffId = null;
  document.getElementById("deleteModalOverlay").style.display = "none";
});

// Confirm Delete
document.getElementById("deleteConfirmBtn").addEventListener("click", async () => {
  if (!window.selectedStaffId) return;

  try {
    const staffDocId = generateStaffDocId(window.selectedStaffId, window.userOffice, window.userDepartment, window.userCategory);

    const docRef = db.collection("User").doc("Designees")
      .collection("StaffDocs").doc(staffDocId);

    const docSnap = await docRef.get();
    if (!docSnap.exists) return alert("Staff not found.");

    await docRef.delete();

    alert("Staff deleted successfully!");
    document.getElementById("deleteModalOverlay").style.display = "none";
    await loadAllStaff();

  } catch (err) {
    console.error(err);
    alert("Error deleting staff.");
  }
});
