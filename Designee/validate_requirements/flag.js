document.addEventListener("DOMContentLoaded", () => {
    console.log("flag.js loaded ✅");

    if (typeof db === "undefined") {
        console.error("❌ Firestore db not found.");
        return;
    }

    const studentsTableBody = document.getElementById("studentsTableBody");
    if (!studentsTableBody) return;

    let currentUserId = null;
    let role = null;
    let createdByDesigneeID = null;

    const userDataStr = localStorage.getItem("userData");
    if (userDataStr) {
        try {
            const userData = JSON.parse(userDataStr);
            role = (userData.role || "").toLowerCase();
            currentUserId = userData.userID || userData.id;
            createdByDesigneeID = userData.createdByDesigneeID || null;
        } catch (err) { console.error(err); }
    }

    function getViolationId() {
        if (role === "designee") return currentUserId;
        if (role === "staff") return createdByDesigneeID;
        return null;
    }

    async function toggleViolation(studentId, collectionName, checkboxEl) {
        try {
            const violationId = getViolationId();
            if (!violationId) return;

            const studentRef = db.collection(collectionName).doc(studentId);
            const snap = await studentRef.get();
            if (!snap.exists) return;

            let violations = snap.data().violation || [];
            if (!Array.isArray(violations)) violations = [];

            if (checkboxEl.checked) {
                if (!violations.includes(violationId)) violations.push(violationId);
            } else {
                violations = violations.filter(id => id !== violationId);
            }

            await studentRef.set({ violation: violations }, { merge: true });
            console.log(`✅ Updated violation for ${studentId}:`, violations);
        } catch (err) {
            console.error("❌ Failed to update violation:", err);
        }
    }

    async function toggleOfficer(studentId, collectionName, checkboxEl) {
        try {
            const officerId = getViolationId(); // same logic as violation
            if (!officerId) return;

            const studentRef = db.collection(collectionName).doc(studentId);
            const snap = await studentRef.get();
            if (!snap.exists) return;

            let officers = snap.data().officer || [];
            if (!Array.isArray(officers)) officers = [];

            if (checkboxEl.checked) {
                if (!officers.includes(officerId)) officers.push(officerId);
            } else {
                officers = officers.filter(id => id !== officerId);
            }

            await studentRef.set({ officer: officers }, { merge: true });
            console.log(`✅ Updated officer for ${studentId}:`, officers);
        } catch (err) {
            console.error("❌ Failed to update officer:", err);
        }
    }

    window.attachFlagButtons = function(collectionName) {
        const rows = studentsTableBody.querySelectorAll("tr");
        rows.forEach(async row => {
            const studentId = row.getAttribute("data-id");
            if (!studentId) return;

            const snap = await db.collection(collectionName).doc(studentId).get();
            if (!snap.exists) return;
            const data = snap.data() || {};

            // -------------------- VIOLATION --------------------
            if (!row.querySelector(".violation-checkbox")) {
                let violationCell = row.querySelector(".flag-cell");
                if (!violationCell) {
                    violationCell = document.createElement("td");
                    violationCell.classList.add("flag-cell");
                    row.insertBefore(violationCell, row.firstChild);
                }

                const violationCheckbox = document.createElement("input");
                violationCheckbox.type = "checkbox";
                violationCheckbox.classList.add("violation-checkbox");
                violationCheckbox.title = "Violation";

                const violationId = getViolationId();
                violationCheckbox.checked = Array.isArray(data.violation) && violationId && data.violation.includes(violationId);

                violationCheckbox.addEventListener("change", () => toggleViolation(studentId, collectionName, violationCheckbox));
                violationCell.appendChild(violationCheckbox);
            }

            // -------------------- OFFICER --------------------
            if (!row.querySelector(".officer-checkbox")) {
                let officerCell = row.querySelector(".officer-cell");
                if (!officerCell) {
                    officerCell = document.createElement("td");
                    officerCell.classList.add("officer-cell");
                    row.insertBefore(officerCell, row.children[1]);
                }

                const officerCheckbox = document.createElement("input");
                officerCheckbox.type = "checkbox";
                officerCheckbox.classList.add("officer-checkbox");
                officerCheckbox.title = "Officer";

                const officerId = getViolationId();
                officerCheckbox.checked = Array.isArray(data.officer) && officerId && data.officer.includes(officerId);

                officerCheckbox.addEventListener("change", () => toggleOfficer(studentId, collectionName, officerCheckbox));
                officerCell.appendChild(officerCheckbox);
            }
        });
    };
});
