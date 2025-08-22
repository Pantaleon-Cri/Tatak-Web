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
    userOffice = d.office || ''; userCategory = d.category || ''; userDepartment = d.department || '';

    // Check duplicate
    const existing = await db.collection("staffTable")
      .where("id","==",id).where("office","==",userOffice)
      .where("category","==",userCategory).where("department","==",userDepartment).get();

    if (!existing.empty) return alert("Staff with this ID already exists.");

    // Generate doc ID
    const newDocId = await db.runTransaction(async (t) => {
      const counterRef = db.collection("counters").doc("staffCounter");
      const counterDoc = await t.get(counterRef);
      let newCount = counterDoc.exists ? counterDoc.data().count + 1 : 1;
      t.set(counterRef, { count: newCount }, { merge: true });
      return "Staff" + newCount;
    });

    await db.collection("staffTable").doc(newDocId).set({
      id, firstName, lastName, email, password,
      category: userCategory, department: userDepartment, office: userOffice,
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
}

async function getDesigneeInfoAndLoadStaff(userId) {
  const doc = await db.collection("Designees").doc(userId).get();
  if (!doc.exists) return;
  const d = doc.data();
  userOffice = d.office || ''; userCategory = d.category || ''; userDepartment = d.department || '';
  await loadAllStaff();
}

async function loadAllStaff() {
  const snapshot = await db.collection("staffTable")
    .where("office","==",userOffice)
    .where("category","==",userCategory)
    .where("department","==",userDepartment)
    .orderBy("createdAt","desc")
    .get();

  const tbody = document.querySelector("tbody");
  tbody.innerHTML = "";
  snapshot.forEach(doc => addRowToTable(doc.data()));
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
