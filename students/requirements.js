// ========================== Firebase v8 Initialization ==========================
var firebaseConfig = {
  apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
  authDomain: "tatak-mobile-web.firebaseapp.com",
  projectId: "tatak-mobile-web",
  storageBucket: "tatak-mobile-web.appspot.com",
  messagingSenderId: "771908675869",
  appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
  measurementId: "G-CENPP29LKQ"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ========================== Utilities ==========================
function normalizeString(str) {
  return String(str || "").trim().toLowerCase();
}

// Resolve office name from designee
async function resolveOfficeName(designeeID) {
  try {
    const snap = await db.collection("/User/Designees/DesigneesDocs").doc(designeeID).get();
    if (!snap.exists) return designeeID;
    const designee = snap.data();

    if (designee.category) {
      let catDoc = await db.collection("/DataTable/Clubs/ClubsDocs").doc(designee.category).get();
      if (catDoc.exists && catDoc.data().club) return catDoc.data().club;

      catDoc = await db.collection("/DataTable/Lab/LabDocs").doc(designee.category).get();
      if (catDoc.exists && catDoc.data().lab) return catDoc.data().lab;
    }

    if (designee.department) {
      const depDoc = await db.collection("/DataTable/Department/DepartmentDocs").doc(designee.department).get();
      const depName = depDoc.exists ? depDoc.data().department : "";

      if (designee.office) {
        const officeDoc = await db.collection("/DataTable/Office/OfficeDocs").doc(designee.office).get();
        const officeName = officeDoc.exists ? officeDoc.data().office : "";
        return depName && officeName ? `${depName} - ${officeName}` : depName || officeName;
      }
      return depName;
    }

    if (designee.office) {
      const officeDoc = await db.collection("/DataTable/Office/OfficeDocs").doc(designee.office).get();
      if (officeDoc.exists) return officeDoc.data().office;
    }

    if (designee.firstName || designee.lastName) {
      return `${designee.firstName || ""} ${designee.lastName || ""}`.trim();
    }

    return designeeID;
  } catch (err) {
    console.error("Error resolving office name:", err);
    return designeeID;
  }
}

// ========================== Load Current Semester ==========================
async function getCurrentSemester() {
  try {
    const semesterSnapshot = await db.collection("/DataTable/Semester/SemesterDocs")
                                     .where("currentSemester", "==", true)
                                     .limit(1)
                                     .get();
    if (!semesterSnapshot.empty) {
      const semesterData = semesterSnapshot.docs[0].data();
      console.log("Current semester found:", semesterData.semester);
      return { id: semesterSnapshot.docs[0].id, name: semesterData.semester };
    } else {
      console.log("No current semester found in Firestore.");
    }
  } catch (err) {
    console.error("Error fetching semester:", err);
  }
  return null;
}

// ========================== Main ==========================
document.addEventListener("DOMContentLoaded", async () => {
  const semester = await getCurrentSemester();
  if (!semester) {
    alert("No active semester found.");
    return;
  }
  document.getElementById("semesterDisplay").textContent = semester.name;

  const studentId = localStorage.getItem("schoolID");
  if (!studentId) {
    alert("Session expired. Please log in again.");
    window.location.href = "../../login/student_login.html";
    return;
  }

  const container = document.querySelector(".student-main-content");
  container.innerHTML = "";

  try {
    const designeeSnap = await db.collection("/User/Designees/DesigneesDocs").get();
    if (designeeSnap.empty) {
      container.innerHTML = "<p>No offices found in Validation</p>";
      console.log("No designees found in Firestore.");
      return;
    }

    let anyRequirementsFound = false;

    for (const designeeDoc of designeeSnap.docs) {
      const designeeID = designeeDoc.id;
      console.log("Processing designee:", designeeID);

      // Check if student exists under this designee
      const semesterDoc = await db
        .collection("Validation")
        .doc(designeeID)
        .collection(studentId)
        .doc(semester.id)
        .get();

      if (!semesterDoc.exists) {
        console.log(`No validation document for student ${studentId} in designee ${designeeID}`);
        continue;
      }

      const requirements = semesterDoc.data().requirements || [];
      console.log(`Requirements found for ${designeeID}:`, requirements);

      if (requirements.length === 0) continue;
      anyRequirementsFound = true;

      const officeName = await resolveOfficeName(designeeID);

      // Build requirements HTML
      let reqHTML = "<ul class='requirements-list'>";
      for (const req of requirements) {
        const safeId = req.requirement.replace(/\s+/g, "-").toLowerCase();
        const checked = req.status ? "checked" : "";
        reqHTML += `<li class="requirement-item">
                      <input type="checkbox" id="${safeId}" ${checked} onclick="return false;">
                      <label for="${safeId}">${req.requirement}</label>
                    </li>`;
      }
      reqHTML += "</ul>";

      // ========================== Fetch Notes ==========================
      let notesHTML = "<p>No Notes Yet</p>";
try {
  const notesSnap = await db
    .collection("RequirementsAndNotes") // collection
    .doc("NotesList")                  // doc
    .collection(designeeID)            // subcollection for designee
    .get();

  if (!notesSnap.empty) {
    notesHTML = "";
    notesSnap.forEach(doc => {
      const noteData = doc.data();
      console.log(`Note found for ${designeeID}:`, noteData);

      // Only show notes for this designee and current semester
      if (noteData.addedBy === designeeID && noteData.semesterId === semester.id) {
        notesHTML += `<p>${noteData.note}</p>`;
      }
    });
  } else {
    console.log(`No notes found for designeeID ${designeeID}`);
  }
} catch (e) {
  console.warn("Error fetching notes:", e);
}


      // Render section
      const section = document.createElement("div");
      section.className = "clearance-section-card";
      section.innerHTML = `
        <div class="section-header">${officeName}</div>
        ${reqHTML}
        <div class="notes-section">
          <h4>Notes</h4>
          ${notesHTML}
        </div>
      `;
      container.appendChild(section);
    }

    if (!anyRequirementsFound) {
      container.innerHTML = `<div class="clearance-section-card">
                               <div class="section-header">No Requirements Found</div>
                             </div>`;
    }

  } catch (err) {
    console.error("Error loading requirements:", err);
    container.innerHTML = "<p>Error loading requirements. Please try again later.</p>";
  }
});
