// -----------------------------------------------------
// Registrazione del Service Worker
// -----------------------------------------------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(registration => {
        console.log('Service Worker registrato con successo:', registration);
      })
      .catch(error => {
        console.error('Registrazione Service Worker fallita:', error);
      });
  });
}

// Variabile globale per contenere i dati del CSV importato (listino)
let listino = [];

// -----------------------------------------------------
// 1) FUNZIONI DI PARSING/FORMATTAZIONE ALL'ITALIANA
// -----------------------------------------------------

/** 
 * parseNumberITA(str)
 * Interpreta "4.000,50" come 4000.50
 */
function parseNumberITA(str) {
  if (!str) return 0;
  let pulito = str.replace(/[^\d.,-]/g, "");  // Elimina simboli non numerici
  pulito = pulito.replace(/\./g, "");         // Rimuove i punti
  pulito = pulito.replace(",", ".");          // Virgola -> Punto
  let val = parseFloat(pulito);
  return isNaN(val) ? 0 : val;
}

/**
 * formatNumberITA(num)
 * Restituisce un numero in stile it-IT, es. 4000.5 => "4.000,50"
 */
function formatNumberITA(num) {
  if (isNaN(num)) num = 0;
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

// -----------------------------------------------------
// 2) INIZIALIZZAZIONE IMPORT CSV
// -----------------------------------------------------
function initCSVImport() {
  const fileInput = document.getElementById("csvFileInput");
  if (!fileInput) return;

  // Al cambio del file CSV, usiamo Papa Parse
  fileInput.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      // Se il CSV usa il punto e virgola come delimitatore, scommenta la riga seguente:
      // delimiter: ';',
      complete: function(results) {
        // results.data è un array di array [ [col0, col1, col2, ...], ... ]
        // Saltiamo la prima riga (header) e leggiamo solo le prime 3 colonne
        listino = results.data.map((row, idx) => {
          if (idx === 0) return null; // Saltiamo l'header
          return {
            codice: (row[0] || "").trim(),
            descrizione: (row[1] || "").trim(),
            prezzoLordo: (row[2] || "").trim()
          };
        }).filter(Boolean);

        console.log("CSV importato, elementi:", listino.length);
        aggiornaListinoSelect();
      },
      error: function(err) {
        console.error("Errore nel parsing del CSV:", err);
      }
    });
  });

  // Quando digitiamo nel campo di ricerca, aggiorniamo la select
  const searchInput = document.getElementById("searchListino");
  if (searchInput) {
    searchInput.addEventListener("input", function() {
      aggiornaListinoSelect();
    });
  }
}

// Aggiorna il menù a tendina filtrato
function aggiornaListinoSelect() {
  const select = document.getElementById("listinoSelect");
  const searchTerm = document.getElementById("searchListino").value.toLowerCase();
  select.innerHTML = "";

  // Filtro sugli articoli del listino
  const filtered = listino.filter(item => {
    const codice = item.codice.toLowerCase();
    const desc = item.descrizione.toLowerCase();
    return codice.includes(searchTerm) || desc.includes(searchTerm);
  });

  // Popoliamo la select con i risultati filtrati
  filtered.forEach((item, index) => {
    const option = document.createElement("option");
    option.value = index; 
    option.textContent = `${item.codice} - ${item.descrizione} - €${item.prezzoLordo}`;
    select.appendChild(option);
  });
}

// Al click su "Aggiungi Articolo Selezionato"
function aggiungiArticoloDaListino() {
  const select = document.getElementById("listinoSelect");
  if (!select.value) return;

  // Rifacciamo lo stesso filtro usato per popolare la select
  const searchTerm = document.getElementById("searchListino").value.toLowerCase();
  const filtered = listino.filter(item => {
    const codice = item.codice.toLowerCase();
    const desc = item.descrizione.toLowerCase();
    return codice.includes(searchTerm) || desc.includes(searchTerm);
  });

  // Prendiamo l'elemento selezionato
  const item = filtered[parseInt(select.value)];
  if (!item) return;

  // Creiamo l'oggetto compatibile con aggiungiArticoloConDati
  const datiArticolo = {
    codice: item.codice,
    descrizione: item.descrizione,
    prezzoLordo: item.prezzoLordo,
    sconto: "",
    prezzoNetto: "",
    quantita: "1",
    prezzoTotale: ""
  };

  // Aggiungiamo la "riga" articolo con i dati
  aggiungiArticoloConDati(datiArticolo);
}

// -----------------------------------------------------
// 3) INIZIALIZZAZIONE DELLA PAGINA
// -----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initCSVImport();

  // Puoi aggiungere qui altri event listener se necessario
});

// -----------------------------------------------------
// 4) GESTIONE ARTICOLI
// -----------------------------------------------------
function aggiungiArticolo() {
  const container = document.getElementById("articoli-container");
  const idUnico = Date.now();
  const div = document.createElement("div");
  div.classList.add("articolo");
  div.innerHTML = `
    <details id="articolo-${idUnico}" open>
      <summary>Nuovo Articolo</summary>
      <label>Codice: 
        <input type="text" class="codice" oninput="aggiornaTitolo(this, ${idUnico})">
      </label>
      <label>Descrizione: 
        <input type="text" class="descrizione">
      </label>
      <label>Prezzo Lordo (€): 
        <input type="text" class="prezzoLordo" oninput="calcolaPrezzo(this)">
      </label>
      <label>Sconto (%): 
        <input type="number" class="sconto" step="0.01" oninput="calcolaPrezzo(this)">
      </label>
      <label>Prezzo Netto (€):
        <input type="text" class="prezzoNetto" oninput="calcolaPrezzo(this)">
      </label>
      <label>Quantità:
        <input type="text" class="quantita" value="1" oninput="calcolaPrezzo(this)">
      </label>
      <label>Prezzo Totale (€):
        <input type="text" class="prezzoTotale" readonly>
      </label>
      <button onclick="salvaArticolo(${idUnico})">Salva</button>
      <button onclick="rimuoviArticolo(this)">Rimuovi</button>
    </details>
  `;
  container.appendChild(div);
}

function aggiungiArticoloConDati(dati) {
  const container = document.getElementById("articoli-container");
  const idUnico = Date.now() + Math.floor(Math.random() * 1000);
  const div = document.createElement("div");
  div.classList.add("articolo");
  div.innerHTML = `
    <details id="articolo-${idUnico}" open>
      <summary>${dati.codice || "Nuovo Articolo"}</summary>
      <label>Codice:
        <input type="text" class="codice" 
          value="${dati.codice || ""}" 
          oninput="aggiornaTitolo(this, ${idUnico})">
      </label>
      <label>Descrizione:
        <input type="text" class="descrizione" 
          value="${dati.descrizione || ""}">
      </label>
      <label>Prezzo Lordo (€):
        <input type="text" class="prezzoLordo" 
          value="${dati.prezzoLordo || ""}" 
          oninput="calcolaPrezzo(this)">
      </label>
      <label>Sconto (%):
        <input type="number" class="sconto" step="0.01"
          value="${dati.sconto || ""}" 
          oninput="calcolaPrezzo(this)">
      </label>
      <label>Prezzo Netto (€):
        <input type="text" class="prezzoNetto" 
          value="${dati.prezzoNetto || ""}" 
          oninput="calcolaPrezzo(this)">
      </label>
      <label>Quantità:
        <input type="text" class="quantita" value="${dati.quantita || 1}"
          oninput="calcolaPrezzo(this)">
      </label>
      <label>Prezzo Totale (€):
        <input type="text" class="prezzoTotale"
          value="${dati.prezzoTotale || ""}" 
          readonly>
      </label>
      <button onclick="salvaArticolo(${idUnico})">Salva</button>
      <button onclick="rimuoviArticolo(this)">Rimuovi</button>
    </details>
  `;
  container.appendChild(div);
}

function aggiornaTitolo(input, id) {
  const summary = document.querySelector(`#articolo-${id} summary`);
  summary.textContent = input.value || "Nuovo Articolo";
}

function salvaArticolo(id) {
  document.getElementById(`articolo-${id}`).open = false;
}

function rimuoviArticolo(btn) {
  btn.parentElement.parentElement.remove();
  aggiornaTotaleGenerale();
}

// -----------------------------------------------------
// 5) CALCOLO PREZZI ARTICOLO
// -----------------------------------------------------
function calcolaPrezzo(input) {
  const row = input.closest(".articolo");

  // Interpretiamo come numeri in stile it-IT
  let prezzoLordo = parseNumberITA(row.querySelector(".prezzoLordo").value);
  let sconto      = parseFloat(row.querySelector(".sconto").value) || 0;
  let quantita    = parseNumberITA(row.querySelector(".quantita").value);

  const prezzoNettoEl = row.querySelector(".prezzoNetto");
  let prezzoNetto     = parseNumberITA(prezzoNettoEl.value);

  // Se l'input è Prezzo Lordo o Sconto, ricalcoliamo Prezzo Netto
  if (input.classList.contains("prezzoLordo") || input.classList.contains("sconto")) {
    prezzoNetto = prezzoLordo * (1 - sconto / 100);
    // Sovrascriviamo il Prezzo Netto col valore formattato
    prezzoNettoEl.value = formatNumberITA(prezzoNetto);
  }
  // Se l'input è Prezzo Netto, usiamo il valore digitato manualmente
  const manualNetto = parseNumberITA(prezzoNettoEl.value) || 0;
  let prezzoTotale = manualNetto * quantita;
  row.querySelector(".prezzoTotale").value = formatNumberITA(prezzoTotale);

  aggiornaTotaleGenerale();
}

// -----------------------------------------------------
// 6) CALCOLO TOTALI (Articoli, Margine, Trasporto, etc.)
// -----------------------------------------------------
function aggiornaTotaleGenerale() {
  let totaleGenerale = 0;
  document.querySelectorAll(".prezzoTotale").forEach(input => {
    totaleGenerale += parseNumberITA(input.value);
  });
  document.getElementById("totaleArticoli").textContent =
    `Totale Articoli: ${formatNumberITA(totaleGenerale)}€`;
  calcolaMarginalita();
}

function calcolaMarginalita() {
  const testoTotale = document.getElementById("totaleArticoli").textContent;
  let match = testoTotale.match(/([\d.,]+)/);
  let totaleArticoli = 0;
  if (match) {
    totaleArticoli = parseNumberITA(match[1]);
  }
  const margine = parseFloat(document.getElementById("margine").value) || 0;
  let nuovoTotale = totaleArticoli;
  if (margine > 0) {
    nuovoTotale = totaleArticoli / (1 - margine / 100);
  }
  document.getElementById("totaleMarginalita").textContent =
    `Nuovo Totale Articoli: ${formatNumberITA(nuovoTotale)}€`;
  calcolaTotaleFinale();
}

function calcolaTotaleFinale() {
  const trasportoVal     = document.getElementById("costoTrasporto").value;
  const installazioneVal = document.getElementById("costoInstallazione").value;

  let trasportoNum      = parseNumberITA(trasportoVal);
  let installazioneNum  = parseNumberITA(installazioneVal);

  const testoMarginalita = document.getElementById("totaleMarginalita").textContent;
  let match = testoMarginalita.match(/([\d.,]+)/);
  let nuovoTotale = 0;
  if (match) {
    nuovoTotale = parseNumberITA(match[1]);
  }

  let finale = nuovoTotale + trasportoNum + installazioneNum;
  document.getElementById("totaleFinale").textContent =
    `Totale Finale: ${formatNumberITA(finale)}€`;
}
