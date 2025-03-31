document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const importBtn = document.getElementById('importBtn');
    const exportBtn = document.getElementById('exportBtn');
    const jsonInput = document.getElementById('jsonInput');
    const jsonOutput = document.getElementById('jsonOutput');
    const columns = document.querySelectorAll('.kanban-column .cards');
    const board = document.querySelector('.kanban-board');
    const toggleImportExportBtn = document.getElementById('toggleImportExportBtn');
    const controlsContainer = document.querySelector('.controls');
    const addCardBtnGlobal = document.getElementById('addCardBtnGlobal');
    const sortPriorityBtn = document.getElementById('sortPriorityBtn');
    const sortIdBtn = document.getElementById('sortIdBtn');

    // Add Card Modal Elements
    const addCardModal = document.getElementById('addCardModal');
    const closeAddModalBtn = addCardModal.querySelector('.close-btn');
    const addForm = document.getElementById('addForm');
    const addTitleInput = document.getElementById('addTitle');
    const addDescriptionInput = document.getElementById('addDescription');
    const addPriorityInput = document.getElementById('addPriority');
    const addEffortInput = document.getElementById('addEffort');
    const addAcceptanceInput = document.getElementById('addAcceptance');
    const addCategoryInput = document.getElementById('addCategory');
    const addTechnicalInput = document.getElementById('addTechnical');

    // Edit Modal Elements
    const editModal = document.getElementById('editModal');
    const closeEditModalBtn = editModal.querySelector('.close-btn');
    const editForm = document.getElementById('editForm');
    const editCardIdInput = document.getElementById('editCardId');
    const editTitleInput = document.getElementById('editTitle');
    const editDescriptionInput = document.getElementById('editDescription');
    const editPriorityInput = document.getElementById('editPriority');
    const editEffortInput = document.getElementById('editEffort');
    const editAcceptanceInput = document.getElementById('editAcceptance');
    const editCategoryInput = document.getElementById('editCategory');
    const editTechnicalInput = document.getElementById('editTechnical');

    // View Card Modal Elements
    const viewModal = document.getElementById('viewModal');
    const closeViewModalBtn = viewModal.querySelector('.close-btn');
    const viewCardContent = document.getElementById('viewCardContent');


    // --- State ---
    let originalCardData = {}; // Store original data + edits { id: { cardData... }, ... }
    const localStorageKey = 'kanbanBoardState';
    const priorityOrder = { "Critica": 4, "Alta": 3, "Media": 2, "Bassa": 1 }; // For sorting

    // --- Initialization ---
    loadBoardState(); // Load saved state on page load
    setupEventListeners(); // Setup all event listeners

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        importBtn.addEventListener('click', handleImport);
        exportBtn.addEventListener('click', handleExport);
        toggleImportExportBtn.addEventListener('click', toggleImportExport);
        addCardBtnGlobal.addEventListener('click', openAddModal);
        sortPriorityBtn.addEventListener('click', () => sortColumns('priority'));
        sortIdBtn.addEventListener('click', () => sortColumns('id'));


        // Drag and Drop Listeners (using event delegation on the board)
        board.addEventListener('dragstart', handleDragStart);
        board.addEventListener('dragend', handleDragEnd);
        // Click listener on the board for Edit and View actions
        board.addEventListener('click', handleBoardClick);


        columns.forEach(column => {
            column.addEventListener('dragover', handleDragOver);
            column.addEventListener('dragenter', handleDragEnter);
            column.addEventListener('dragleave', handleDragLeave);
            column.addEventListener('drop', handleDrop);
        });

        // Modal Listeners
        closeAddModalBtn.addEventListener('click', closeAddModal);
        addForm.addEventListener('submit', handleAddFormSubmit);

        closeEditModalBtn.addEventListener('click', closeEditModal);
        editForm.addEventListener('submit', handleEditFormSubmit);

        closeViewModalBtn.addEventListener('click', closeViewModal);

        // Close modals on outside click
        window.addEventListener('click', (event) => {
            if (event.target === addCardModal) closeAddModal();
            if (event.target === editModal) closeEditModal();
            if (event.target === viewModal) closeViewModal();
        });
    }

    // --- Core Functions ---

    function handleImport() {
        const jsonString = jsonInput.value.trim();
        if (!jsonString) {
            alert('Per favore, incolla il JSON nell\'area di testo.');
            return;
        }
        try {
            const cardsDataArray = JSON.parse(jsonString);
            if (!Array.isArray(cardsDataArray)) {
                throw new Error("Il JSON importato deve essere un array di oggetti card.");
            }
            clearBoard();
            originalCardData = {};
            cardsDataArray.forEach(cardData => addCardInternal(cardData, cardData.status ?? 'todo', false)); // Add to 'todo', don't save yet
            saveBoardState(); // Save once after all imports
            jsonInput.value = '';
            jsonOutput.value = '';
            alert('Cards importate con successo nella colonna "To Do"!');
        } catch (error) {
            alert(`Errore durante l'importazione del JSON: ${error.message}\nControlla la console per dettagli.`);
            console.error("JSON Parse Error:", error);
            loadBoardState();
        }
    }

    function handleExport() {
        const boardState = getCurrentBoardState();
        jsonOutput.value = JSON.stringify(boardState, null, 2);
        if (boardState.length > 0) {
            alert('Stato attuale del board esportato nell\'area di testo sottostante.');
        } else {
            alert('Il board è vuoto. Nulla da esportare.');
        }
    }

    function createCardElement(cardData) {
        const card = document.createElement('div');
        card.classList.add('kanban-card');
        card.setAttribute('draggable', true);
        card.dataset.id = cardData.id;
        card.dataset.priority = cardData.priority || 'Media';

        // Simplified preview structure
        card.innerHTML = `
            <button class="edit-card-btn" title="Modifica Card">✏️</button>
            <div class="card-title">${cardData.title || 'N/D'}</div>
            <p class="card-description-preview">${(cardData.description || '').substring(0, 100)}${(cardData.description || '').length > 100 ? '...' : ''}</p>
            <div class="card-meta">
                <span><strong>Effort:</strong> ${cardData.effort || 'N/D'}</span>
                <span><strong>Priority:</strong> ${cardData.priority || 'N/D'}</span>
                <span><strong>Cat:</strong> ${cardData.category || 'N/D'}</span>
            </div>
            <small class="card-id">ID: ${cardData.id}</small>
        `;
        return card;
    }

    function updateCardElement(cardId) {
         const cardElement = board.querySelector(`.kanban-card[data-id="${cardId}"]`);
         const cardData = originalCardData[cardId];
         if (!cardElement || !cardData) return;

         // Update dataset for styling/sorting
         cardElement.dataset.priority = cardData.priority || 'Media';

         // Update preview content
         cardElement.querySelector('.card-title').textContent = cardData.title || 'N/D';
         const descPreview = cardElement.querySelector('.card-description-preview');
         if (descPreview) {
             descPreview.textContent = `${(cardData.description || '').substring(0, 100)}${(cardData.description || '').length > 100 ? '...' : ''}`;
         }
         const metaDiv = cardElement.querySelector('.card-meta');
          if (metaDiv) {
            metaDiv.querySelector('span:nth-of-type(1)').innerHTML = `<strong>Effort:</strong> ${cardData.effort || 'N/D'}`;
            metaDiv.querySelector('span:nth-of-type(2)').innerHTML = `<strong>Priority:</strong> ${cardData.priority || 'N/D'}`;
            metaDiv.querySelector('span:nth-of-type(3)').innerHTML = `<strong>Cat:</strong> ${cardData.category || 'N/D'}`;
          }
          // ID remains the same
     }


    function clearBoard() {
        columns.forEach(column => {
            column.innerHTML = '';
        });
    }

    function toggleImportExport() {
        controlsContainer.classList.toggle('collapsed');
    }

    // --- Drag and Drop Handlers ---
    let draggedCard = null;

    function handleDragStart(event) {
        if (event.target.classList.contains('kanban-card')) {
            draggedCard = event.target;
            setTimeout(() => draggedCard.classList.add('dragging'), 0);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', draggedCard.dataset.id);
        } else {
             event.preventDefault();
        }
    }

    function handleDragEnd(event) {
        if (draggedCard) {
            draggedCard.classList.remove('dragging');
        }
        draggedCard = null;
        columns.forEach(col => col.classList.remove('drag-over'));
    }

    function handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(event) {
        event.preventDefault();
        const targetColumnCards = event.target.closest('.cards');
        if (targetColumnCards) {
           targetColumnCards.classList.add('drag-over');
           columns.forEach(col => { if (col !== targetColumnCards) col.classList.remove('drag-over'); });
        }
    }

    function handleDragLeave(event) {
         const currentTarget = event.currentTarget; // The .cards div the listener is on
         const relatedTarget = event.relatedTarget;
         // Remove highlight if mouse leaves the bounds of the .cards div
         if (!currentTarget.contains(relatedTarget) || relatedTarget?.closest('.cards') !== currentTarget) {
            currentTarget.classList.remove('drag-over');
         }
    }

    function handleDrop(event) {
        event.preventDefault();
        const targetColumnCards = event.target.closest('.cards');
        if (targetColumnCards && draggedCard) {
            const previousColumn = draggedCard.parentElement;
            targetColumnCards.appendChild(draggedCard);
            targetColumnCards.classList.remove('drag-over');
            if (previousColumn !== targetColumnCards) {
                saveBoardState(); // Save only if column changed
            }
        } else if(draggedCard) {
            console.warn("Drop attempted outside a valid column zone.");
            targetColumnCards?.classList.remove('drag-over');
        }
    }

     // --- Board Click Handler (Edit/View) ---
     function handleBoardClick(event) {
        const editButton = event.target.closest('.edit-card-btn');
        const cardElement = event.target.closest('.kanban-card');

        if (editButton && cardElement) {
            // Clicked the edit button
            event.stopPropagation(); // Prevent card click from firing
            const cardId = cardElement.dataset.id;
            openEditModal(cardId);
        } else if (cardElement) {
            // Clicked the card body (not the edit button)
            const cardId = cardElement.dataset.id;
            openViewModal(cardId);
        }
    }


    // --- Local Storage ---
    function saveBoardState() {
        const boardState = getCurrentBoardState();
        try {
            localStorage.setItem(localStorageKey, JSON.stringify(boardState));
        } catch (e) {
            console.error("Failed to save board state to localStorage:", e);
            alert("Attenzione: impossibile salvare lo stato del board. Lo spazio di archiviazione locale potrebbe essere pieno.");
        }
    }

    function loadBoardState() {
        const savedStateJSON = localStorage.getItem(localStorageKey);
        if (!savedStateJSON) {
             console.log("No saved state found.");
             return; // Nothing to load, keep board empty
        }
        try {
            const savedState = JSON.parse(savedStateJSON);
            if (!Array.isArray(savedState)) throw new Error("Saved state is not an array.");

            clearBoard();
            originalCardData = {};

            savedState.forEach(cardDataWithStatus => {
                if (cardDataWithStatus && cardDataWithStatus.id && cardDataWithStatus.status) {
                    const { status, ...cardData } = cardDataWithStatus;
                    addCardInternal(cardData, status, false); // Add card internally without saving yet
                } else {
                     console.warn("Skipping invalid card data object from localStorage:", cardDataWithStatus);
                }
            });
            console.log("Board state loaded from localStorage.");
        } catch (error) {
            console.error("Error loading board state from localStorage:", error);
            alert("Errore durante il caricamento dello stato salvato. Verrà visualizzato un board vuoto.");
            localStorage.removeItem(localStorageKey);
            clearBoard();
            originalCardData = {};
        }
    }

    function getCurrentBoardState() {
        const boardState = [];
        columns.forEach(column => {
            const columnId = column.dataset.columnId;
            const cardsInColumn = column.querySelectorAll('.kanban-card');
            cardsInColumn.forEach(cardElement => {
                const cardId = cardElement.dataset.id;
                if (originalCardData[cardId]) {
                    boardState.push({ ...originalCardData[cardId], status: columnId });
                } else {
                    console.warn(`Dati originali non trovati per la card con ID: ${cardId} durante l'esportazione/salvataggio.`);
                }
            });
        });
        // The order in this array might not match visual order after sorting.
        // Load function places them correctly based on 'status'.
        return boardState;
    }

    // --- Add Card ---
    function openAddModal() {
        addForm.reset();
        addCardModal.style.display = 'block';
        addTitleInput.focus(); // Focus on the title field
    }

    function closeAddModal() {
        addCardModal.style.display = 'none';
    }

    function handleAddFormSubmit(event) {
        event.preventDefault();
        const newCardData = {
            id: generateCardId(), // Generate a unique ID
            title: addTitleInput.value.trim(),
            description: addDescriptionInput.value.trim(),
            priority: addPriorityInput.value,
            effort: addEffortInput.value,
            acceptance: addAcceptanceInput.value.trim(),
            category: addCategoryInput.value.trim(),
            technical: addTechnicalInput.value.trim(),
        };

        addCardInternal(newCardData, 'todo', true); // Add to 'todo' column and save
        closeAddModal();
    }

    /** Adds card data to internal store and UI */
    function addCardInternal(cardData, columnId = 'todo', shouldSave = true) {
         if (!cardData || !cardData.id) {
            console.error("Invalid card data provided to addCardInternal", cardData);
            return;
         }
         if(originalCardData[cardData.id]) {
             console.warn(`Card with ID ${cardData.id} already exists. Skipping add.`);
             return; // Avoid duplicates if ID generation somehow clashes or during import
         }

         originalCardData[cardData.id] = { ...cardData }; // Store data

         const cardElement = createCardElement(cardData);
         const targetColumn = document.getElementById(columnId)?.querySelector('.cards');

         if (targetColumn) {
             targetColumn.appendChild(cardElement);
         } else {
             console.warn(`Column "${columnId}" not found for new card ID "${cardData.id}". Placing in 'To Do'.`);
             document.getElementById('todo').querySelector('.cards').appendChild(cardElement);
         }

         if (shouldSave) {
             saveBoardState(); // Save state if requested (e.g., manual add)
         }
    }

    function generateCardId() {
        // Simple ID generator: Prefix + timestamp + random element
        // Check if it already exists (highly unlikely but possible)
        let newId;
        do {
            newId = `MAN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        } while (originalCardData[newId]);
        return newId;
    }

    // --- Edit Card ---
    function openEditModal(cardId) {
        const cardData = originalCardData[cardId];
        if (!cardData) return;
        editCardIdInput.value = cardId;
        editTitleInput.value = cardData.title || '';
        editDescriptionInput.value = cardData.description || '';
        editPriorityInput.value = cardData.priority || 'Media';
        editEffortInput.value = cardData.effort || 'Medium';
        editAcceptanceInput.value = cardData.acceptance || '';
        editCategoryInput.value = cardData.category || '';
        editTechnicalInput.value = cardData.technical || '';
        editModal.style.display = 'block';
    }

    function closeEditModal() {
        editModal.style.display = 'none';
        // No need to reset form here, it's populated on open
    }

    function handleEditFormSubmit(event) {
        event.preventDefault();
        const cardId = editCardIdInput.value;
        if (!originalCardData[cardId]) return;

        originalCardData[cardId] = {
            ...originalCardData[cardId], // Preserve ID and potentially other fields
            title: editTitleInput.value.trim(),
            description: editDescriptionInput.value.trim(),
            priority: editPriorityInput.value,
            effort: editEffortInput.value,
            acceptance: editAcceptanceInput.value.trim(),
            category: editCategoryInput.value.trim(),
            technical: editTechnicalInput.value.trim(),
        };

        updateCardElement(cardId); // Update visual card
        saveBoardState(); // Save updated data
        closeEditModal();
        alert('Card aggiornata con successo!');
    }

    // --- View Card ---
    function openViewModal(cardId) {
        const cardData = originalCardData[cardId];
        if (!cardData) return;

        // Generate formatted HTML for the view modal
        viewCardContent.innerHTML = `
            <h3>${cardData.title || 'N/D'}</h3>
            <span class="detail-label">ID:</span>
            <span class="detail-value">${cardData.id}</span>
            <hr>
            <span class="detail-label">Priority:</span>
            <span class="detail-value">${cardData.priority || 'N/D'}</span>
            <span class="detail-label">Effort:</span>
            <span class="detail-value">${cardData.effort || 'N/D'}</span>
            <span class="detail-label">Category:</span>
            <span class="detail-value">${cardData.category || 'N/D'}</span>
            <hr>
            <span class="detail-label">Description:</span>
            <div class="detail-value">${cardData.description || '<em>Nessuna descrizione</em>'}</div>
            <hr>
            <span class="detail-label">Acceptance Criteria:</span>
            <pre class="detail-value">${cardData.acceptance || '<em>N/D</em>'}</pre>
            <hr>
            <span class="detail-label">Technical Notes:</span>
            <pre class="detail-value">${cardData.technical || '<em>N/D</em>'}</pre>
        `;
        viewModal.style.display = 'block';
    }

    function closeViewModal() {
        viewModal.style.display = 'none';
        viewCardContent.innerHTML = ''; // Clear content
    }

    // --- Sorting ---
    function sortColumns(sortBy) {
        columns.forEach(column => {
            const cardsContainer = column; // The .cards div
            const cardElements = Array.from(cardsContainer.querySelectorAll('.kanban-card'));

            if (cardElements.length <= 1) return; // No need to sort

            let comparisonFunction;
            if (sortBy === 'priority') {
                comparisonFunction = (a, b) => {
                    const priorityA = priorityOrder[a.dataset.priority] || 0;
                    const priorityB = priorityOrder[b.dataset.priority] || 0;
                    return priorityB - priorityA; // Descending priority (Critica first)
                };
            } else if (sortBy === 'id') {
                // Basic alphanumeric sort for ID
                 comparisonFunction = (a, b) => {
                    const idA = a.dataset.id || '';
                    const idB = b.dataset.id || '';
                    // Attempt natural sort for IDs like CORE-1, CORE-10
                     return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
                 };
            } else {
                return; // Invalid sort type
            }

            cardElements.sort(comparisonFunction);

            // Re-append sorted elements
            cardsContainer.innerHTML = ''; // Clear existing
            cardElements.forEach(card => cardsContainer.appendChild(card));
        });
        // Note: Sorting is purely visual within the column.
        // It does NOT change the underlying data order saved to localStorage.
        // The export/load logic rebuilds based on the 'status' property.
         alert(`Colonne ordinate per ${sortBy === 'priority' ? 'priorità' : 'ID'}.`);
    }

}); // End DOMContentLoaded
