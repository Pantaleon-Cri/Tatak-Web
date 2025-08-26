

// DOM Elements
const openBtn = document.getElementById("openModalBtn");
const modal = document.getElementById("modalOverlay");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.querySelector(".save-btn");
const courseInput = document.getElementById("courseName");
const tableBody = document.querySelector("tbody");

// Open modal
openBtn.addEventListener("click", () => {
  courseInput.value = "";
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

// Save new course (auto ID and course only)
saveBtn.addEventListener("click", async () => {
  const courseName = courseInput.value.trim();
  const deptCodeName = document.getElementById("deptCodeName").value.trim();
  const clubCodeName = document.getElementById("clubCodeName").value.trim();

  if (!courseName) {
    alert("Please enter a course name.");
    return;
  }

  try {
    const snapshot = await db.collection("courseTable").get();
    const ids = snapshot.docs.map(doc => parseInt(doc.id)).filter(id => !isNaN(id));
    const nextIdNum = ids.length ? Math.max(...ids) + 1 : 1;
    const nextId = nextIdNum.toString().padStart(3, '0');

    const data = {
      id: nextId,
      course: courseName,
      deptCodeName,
      clubCodeName,s
    };

    await db.collection("courseTable").doc(nextId).set(data);
    addRowToTable(nextId, data);
    modal.style.display = "none";
  } catch (error) {
    console.error("Error saving course:", error);
    alert("Error saving course.");
  }
});


// Load courses on page load
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
    const snapshot = await db.collection("courseTable").get();
    const docs = snapshot.docs
      .filter(doc => !isNaN(parseInt(doc.id)))
      .sort((a, b) => parseInt(a.id) - parseInt(b.id));

    docs.forEach(doc => {
      const data = doc.data();
      addRowToTable(doc.id, data);
    });
  } catch (error) {
    console.error("Error loading courses:", error);
  }
});

// Add a row to the table
function addRowToTable(id, data) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${id}</td>
    <td class="course-name">${data.course || ""}</td>
    <td>${data.deptCodeName || ""}</td>
    <td>${data.clubCodeName || ""}</td>
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
const editCourseInput = document.getElementById("editCourseName");
const editCancelBtn = document.getElementById("editCancelBtn");
const editSaveBtn = document.getElementById("editSaveBtn");

const deleteModal = document.getElementById("deleteModalOverlay");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");

let currentEditId = null;
let currentDeleteId = null;
let currentDeleteRow = null;

// Handle Edit
async function handleEdit(e) {
  const id = e.currentTarget.dataset.id;
  const row = e.currentTarget.closest("tr");

  const courseName = row.querySelector("td:nth-child(2)").textContent.trim();
  const deptCodeName = row.querySelector("td:nth-child(3)").textContent.trim();
  const clubCodeName = row.querySelector("td:nth-child(4)").textContent.trim();

  currentEditId = id;

  document.getElementById("editCourseId").value = id;
  document.getElementById("editCourseName").value = courseName;
  document.getElementById("editDeptCodeName").value = deptCodeName;
  document.getElementById("editClubCodeName").value = clubCodeName;

  editModal.style.display = "flex";
}


// Save Edit
editSaveBtn.addEventListener("click", async () => {
  const newCourse = document.getElementById("editCourseName").value.trim();
  const newDept = document.getElementById("editDeptCodeName").value.trim();
  const newClub = document.getElementById("editClubCodeName").value.trim();

  if (!newCourse) {
    alert("Course name cannot be empty.");
    return;
  }

  try {
    await db.collection("courseTable").doc(currentEditId).update({
      course: newCourse,
      deptCodeName: newDept,
      clubCodeName: newClub
    });

    const row = document.querySelector(`.edit[data-id="${currentEditId}"]`).closest("tr");
    row.querySelector("td:nth-child(2)").textContent = newCourse;
    row.querySelector("td:nth-child(3)").textContent = newDept;
    row.querySelector("td:nth-child(4)").textContent = newClub;

    editModal.style.display = "none";
    currentEditId = null;
  } catch (error) {
    console.error("Error updating course:", error);
    alert("Update failed.");
  }
});


editCancelBtn.addEventListener("click", () => {
  editModal.style.display = "none";
  currentEditId = null;
});

// Delete
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
    await db.collection("courseTable").doc(currentDeleteId).delete();
    currentDeleteRow.remove();
    deleteModal.style.display = "none";
    currentDeleteId = null;
  } catch (error) {
    console.error("Error deleting course:", error);
    alert("Delete failed.");
  }
});

// Upload via Excel
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
      const course = row["Course"]?.trim();
      const dept = row["Dept Code Name"]?.trim() || "";
      const club = row["Club Code Name"]?.trim() || "";

      if (!id || !course) continue;

      try {
        const docRef = db.collection("courseTable").doc(id);
        const docSnap = await docRef.get();
        if (docSnap.exists) continue;

        const payload = {
          id,
          course,
          deptCodeName: dept,
          clubCodeName: club,
        };

        await docRef.set(payload);
        addRowToTable(id, payload);
      } catch (error) {
        console.error(`Failed to upload ${course}:`, error);
      }
    }

    alert("Upload complete!");
    uploadInput.value = "";
  };
  reader.readAsArrayBuffer(file);
}