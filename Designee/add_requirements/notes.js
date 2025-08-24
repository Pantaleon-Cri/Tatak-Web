document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const notesContent = document.getElementById("notesContent");
  const editBtn = document.getElementById("editNotesBtn");
  const saveBtn = document.getElementById("saveNotesBtn");
  const cancelBtn = document.getElementById("cancelNotesBtn");
  const charCountDisplay = document.getElementById("noteCharCount");

  // State vars
  let originalNotes = "";
  let existingDocId = null;
  let currentSemesterId = null;
  let currentSemesterName = null;

  // Utility: Place caret at end of contenteditable div
  function placeCaretAtEnd(el) {
    el.focus();
    if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // Initial UI state
  notesContent.contentEditable = false;
  saveBtn.style.display = "none";
  cancelBtn.style.display = "none";
  editBtn.style.display = "inline-block";

  // --- Step 1: Load current semester ---
  try {
    const semesterSnapshot = await db.collection("semesterTable")
      .where("currentSemester", "==", true)
      .limit(1)
      .get();

    if (semesterSnapshot.empty) throw new Error("No active semester found.");

    const semesterDoc = semesterSnapshot.docs[0].data();
    currentSemesterId = semesterDoc.id;
    currentSemesterName = semesterDoc.semester;
    console.log("Current semester:", currentSemesterName);
  } catch (err) {
    console.error("Error fetching current semester:", err);
    notesContent.innerText = "Failed to load semester info.";
    editBtn.disabled = true;
    return;
  }

  // --- Step 2: Load user data and fetch note ---
  try {
    await getCurrentUserData();

    if (!db) throw new Error("Firestore (db) not initialized.");
    if (!currentUser || !currentUser.id) throw new Error("User not logged in.");

    const normalizedOffice = (userOffice || "").trim();
    const normalizedCategory = (userCategory || "").trim();
    const normalizedDepartment = (userDepartment || "").trim();

    console.log("Loading notes for:", {
      office: normalizedOffice,
      category: normalizedCategory,
      department: normalizedDepartment,
      semester: currentSemesterName
    });

    // Query Firestore for latest note matching filters AND current semester
    const querySnapshot = await db.collection("notesTable")
      .where("office", "==", normalizedOffice)
      .where("category", "==", normalizedCategory)
      .where("department", "==", normalizedDepartment)
      .where("semester", "==", currentSemesterName)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      const noteDoc = querySnapshot.docs[0];
      const noteData = noteDoc.data();

      existingDocId = noteDoc.id;
      originalNotes = noteData.note || "";
      notesContent.innerText = originalNotes;
      charCountDisplay.innerText = `${originalNotes.length} / 150`;
      notesContent.removeAttribute("data-placeholder");
    } else {
      existingDocId = null;
      originalNotes = "";
      notesContent.innerText = "";
      charCountDisplay.innerText = `0 / 150`;
      notesContent.setAttribute("data-placeholder", "No note yet. Click Edit to add.");
    }
  } catch (error) {
    console.error("Error loading note:", error);
    notesContent.innerText = "Failed to load note.";
    notesContent.contentEditable = false;
    editBtn.disabled = true;
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    charCountDisplay.innerText = "0 / 150";
    return;
  }

  // Character counter and enforce max length 150
  notesContent.addEventListener("input", () => {
    let text = notesContent.innerText;
    if (text.length > 150) {
      notesContent.innerText = text.substring(0, 150);
      placeCaretAtEnd(notesContent);
      text = notesContent.innerText;
    }
    charCountDisplay.innerText = `${text.length} / 150`;
  });

  // Edit button click: enable editing
  editBtn.addEventListener("click", () => {
    originalNotes = notesContent.innerText.trim();
    if (originalNotes === "No note yet." || originalNotes === "") {
      notesContent.innerText = "";
    }
    notesContent.contentEditable = true;
    notesContent.focus();
    placeCaretAtEnd(notesContent);

    saveBtn.style.display = "inline-block";
    cancelBtn.style.display = "inline-block";
    editBtn.style.display = "none";
    notesContent.removeAttribute("data-placeholder");
  });

  // Cancel button: revert changes
  cancelBtn.addEventListener("click", () => {
    notesContent.innerText = originalNotes;
    notesContent.contentEditable = false;
    saveBtn.style.display = "none";
    cancelBtn.style.display = "none";
    editBtn.style.display = "inline-block";
    charCountDisplay.innerText = `${originalNotes.length} / 150`;
    if (!originalNotes) notesContent.setAttribute("data-placeholder", "No note yet. Click Edit to add.");
  });

  // Save button: save or update Firestore document
  saveBtn.addEventListener("click", async () => {
    const noteText = notesContent.innerText.trim();

    if (noteText.length > 150) {
      alert(`Note cannot exceed 150 characters.\nCurrent length: ${noteText.length}`);
      return;
    }

    if (!noteText) {
      alert("Note cannot be empty.");
      return;
    }

    try {
      const normalizedOffice = (userOffice || "").trim();
      const normalizedCategory = (userCategory || "").trim();
      const normalizedDepartment = (userDepartment || "").trim();

      if (existingDocId) {
        await db.collection("notesTable").doc(existingDocId).update({
          note: noteText,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          semester: currentSemesterName // Keep semester updated
        });
        alert("Note updated successfully.");
      } else {
        const docRef = await db.collection("notesTable").add({
          note: noteText,
          addedBy: currentUser.id,
          office: normalizedOffice,
          category: normalizedCategory,
          department: normalizedDepartment,
          semester: currentSemesterName,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        existingDocId = docRef.id;
        alert("Note created successfully.");
      }

      originalNotes = noteText;
      notesContent.contentEditable = false;
      saveBtn.style.display = "none";
      cancelBtn.style.display = "none";
      editBtn.style.display = "inline-block";
      charCountDisplay.innerText = `${noteText.length} / 150`;
    } catch (error) {
      console.error("Failed to save note:", error);
      alert("Failed to save note.");
    }
  });
});
