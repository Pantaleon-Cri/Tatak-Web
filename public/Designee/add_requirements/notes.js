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
  let userData = null;
  let designeeId = null;

  // Utility: Place caret at end
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

  // --- Step 0: Load userData ---
  try {
    const storedUserData = localStorage.getItem("userData");
    if (!storedUserData) throw new Error("No userData in localStorage");
    userData = JSON.parse(storedUserData);
    if (!userData.id) throw new Error("userData missing id field");

    // Determine designeeId
    designeeId = userData.role === "designee" ? userData.id : userData.createdByDesigneeID;
    if (!designeeId) throw new Error("Missing createdByDesigneeID for staff");
  } catch (err) {
    console.error("Error loading user data:", err);
    notesContent.innerText = "Failed to load note: user data missing.";
    editBtn.disabled = true;
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    charCountDisplay.innerText = "0 / 150";
    return;
  }

  // --- Step 1: Load current semester ---
  try {
    const semesterSnapshot = await db.collection("DataTable")
      .doc("Semester")
      .collection("SemesterDocs")
      .where("currentSemester", "==", true)
      .limit(1)
      .get();

    if (semesterSnapshot.empty) throw new Error("No active semester found.");

    const semesterDoc = semesterSnapshot.docs[0].data();
    currentSemesterId = semesterSnapshot.docs[0].id; // 🔹 Use ID
    currentSemesterName = semesterDoc.semester;
  } catch (err) {
    console.error("Error fetching current semester:", err);
    notesContent.innerText = "Failed to load semester info.";
    editBtn.disabled = true;
    return;
  }

  // --- Step 2: Load note based on designeeId & semester ID ---
  try {
    const normalizedOffice = (userData.office || "").trim();
    const normalizedCategory = (userData.category || "").trim();
    const normalizedDepartment = (userData.department || "").trim();

    const querySnapshot = await db.collection("RequirementsAndNotes")
      .doc("NotesList")
      .collection(designeeId)
      .where("office", "==", normalizedOffice)
      .where("category", "==", normalizedCategory)
      .where("department", "==", normalizedDepartment)
      .where("semesterId", "==", currentSemesterId) // 🔹 Use semesterId instead of name
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
  } catch (err) {
    console.error("Error loading note:", err);
    notesContent.innerText = "Failed to load note.";
    notesContent.contentEditable = false;
    editBtn.disabled = true;
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    charCountDisplay.innerText = "0 / 150";
    return;
  }

  // Character counter
  notesContent.addEventListener("input", () => {
    let text = notesContent.innerText;
    if (text.length > 150) {
      notesContent.innerText = text.substring(0, 150);
      placeCaretAtEnd(notesContent);
      text = notesContent.innerText;
    }
    charCountDisplay.innerText = `${text.length} / 150`;
  });

  // Edit
  editBtn.addEventListener("click", () => {
    originalNotes = notesContent.innerText.trim();
    if (originalNotes === "No note yet." || originalNotes === "") notesContent.innerText = "";
    notesContent.contentEditable = true;
    notesContent.focus();
    placeCaretAtEnd(notesContent);
    saveBtn.style.display = "inline-block";
    cancelBtn.style.display = "inline-block";
    editBtn.style.display = "none";
    notesContent.removeAttribute("data-placeholder");
  });

  // Cancel
  cancelBtn.addEventListener("click", () => {
    notesContent.innerText = originalNotes;
    notesContent.contentEditable = false;
    saveBtn.style.display = "none";
    cancelBtn.style.display = "none";
    editBtn.style.display = "inline-block";
    charCountDisplay.innerText = `${originalNotes.length} / 150`;
    if (!originalNotes) notesContent.setAttribute("data-placeholder", "No note yet. Click Edit to add.");
  });

  // Save
  saveBtn.addEventListener("click", async () => {
    const noteText = notesContent.innerText.trim();
    if (!noteText) return alert("Note cannot be empty.");
    if (noteText.length > 150) return alert(`Note cannot exceed 150 characters.\nCurrent length: ${noteText.length}`);

    try {
      const normalizedOffice = (userData.office || "").trim();
      const normalizedCategory = (userData.category || "").trim();
      const normalizedDepartment = (userData.department || "").trim();

      const notesRef = db.collection("RequirementsAndNotes")
        .doc("NotesList")
        .collection(designeeId);

      const noteDataPayload = {
        note: noteText,
        addedBy: userData.id,
        addedByRole: userData.role,
        office: normalizedOffice,
        category: normalizedCategory,
        department: normalizedDepartment,
        semesterId: currentSemesterId,   // 🔹 Use ID
        semesterName: currentSemesterName,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (existingDocId) {
        await notesRef.doc(existingDocId).update(noteDataPayload);
        alert("Note updated successfully.");
      } else {
        noteDataPayload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const docRef = await notesRef.add(noteDataPayload);
        existingDocId = docRef.id;
        alert("Note created successfully.");
      }

      originalNotes = noteText;
      notesContent.contentEditable = false;
      saveBtn.style.display = "none";
      cancelBtn.style.display = "none";
      editBtn.style.display = "inline-block";
      charCountDisplay.innerText = `${noteText.length} / 150`;
    } catch (err) {
      console.error("Failed to save note:", err);
      alert("Failed to save note.");
    }
  });
});
