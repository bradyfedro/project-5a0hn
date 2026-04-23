const state = {
  families: [],
  selectedFamilyId: null,
  selectedConverterId: null,
  searchTerm: "",
  charts: {
    kFactor: null,
    torqueRatio: null,
  },
};

const refs = {
  familyCount: document.getElementById("familyCount"),
  converterCount: document.getElementById("converterCount"),
  familyNav: document.getElementById("familyNav"),
  familyEyebrow: document.getElementById("familyEyebrow"),
  converterTitle: document.getElementById("converterTitle"),
  converterMeta: document.getElementById("converterMeta"),
  converterSearch: document.getElementById("converterSearch"),
  converterList: document.getElementById("converterList"),
  converterStats: document.getElementById("converterStats"),
  prevConverter: document.getElementById("prevConverter"),
  nextConverter: document.getElementById("nextConverter"),
  kRange: document.getElementById("kRange"),
  tRange: document.getElementById("tRange"),
  kFactorCanvas: document.getElementById("kFactorChart"),
  torqueRatioCanvas: document.getElementById("torqueRatioChart"),
};

function parseRoute() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return {
    family: params.get("family"),
    converter: params.get("converter"),
  };
}

function updateRoute() {
  const params = new URLSearchParams();
  if (state.selectedFamilyId) params.set("family", state.selectedFamilyId);
  if (state.selectedConverterId) params.set("converter", state.selectedConverterId);
  history.replaceState(null, "", `#${params.toString()}`);
}

async function loadData() {
  if (!window.CONVERTER_DATA?.families?.length) {
    throw new Error("Unable to load converter data.");
  }
  state.families = window.CONVERTER_DATA.families;
}

function getSelectedFamily() {
  return state.families.find((family) => family.id === state.selectedFamilyId) || null;
}

function getVisibleConverters() {
  const family = getSelectedFamily();
  if (!family) return [];
  const term = state.searchTerm.trim().toLowerCase();
  if (!term) return family.converters;
  return family.converters.filter((converter) => converter.name.toLowerCase().includes(term));
}

function getSelectedConverter() {
  return getSelectedFamily()?.converters.find((converter) => converter.id === state.selectedConverterId) || null;
}

function formatNumber(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function setSelection(familyId, converterId) {
  state.selectedFamilyId = familyId;
  const family = getSelectedFamily();
  const visibleIds = family?.converters.map((converter) => converter.id) || [];
  state.selectedConverterId = visibleIds.includes(converterId) ? converterId : visibleIds[0] || null;
  updateRoute();
  render();
}

function renderFamilyNav() {
  refs.familyNav.innerHTML = "";
  state.families.forEach((family) => {
    const button = document.createElement("button");
    button.className = "family-button" + (family.id === state.selectedFamilyId ? " active" : "");
    button.type = "button";
    button.innerHTML = `<span>${family.name}</span><small>${family.converters.length} converter options</small>`;
    button.addEventListener("click", () => {
      state.searchTerm = "";
      refs.converterSearch.value = "";
      setSelection(family.id, family.converters[0]?.id);
    });
    refs.familyNav.appendChild(button);
  });
}

function renderConverterList() {
  const visibleConverters = getVisibleConverters();
  const family = getSelectedFamily();
  if (!family) return;

  if (!visibleConverters.length) {
    refs.converterList.innerHTML = `<p class="section-copy">No converters matched that filter in ${family.name}.</p>`;
    return;
  }

  if (!visibleConverters.some((converter) => converter.id === state.selectedConverterId)) {
    state.selectedConverterId = visibleConverters[0].id;
    updateRoute();
  }

  refs.converterList.innerHTML = "";
  visibleConverters.forEach((converter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "converter-chip" + (converter.id === state.selectedConverterId ? " active" : "");
    button.textContent = converter.name;
    button.addEventListener("click", () => setSelection(family.id, converter.id));
    refs.converterList.appendChild(button);
  });
}

function renderHeader() {
  const family = getSelectedFamily();
  const converter = getSelectedConverter();
  if (!family || !converter) return;

  refs.familyEyebrow.textContent = family.name;
  refs.converterTitle.textContent = converter.name;
  refs.converterMeta.textContent =
    `Stall torque ratio ${formatNumber(converter.stats.stallTorqueRatio)}. Final plotted speed ratio ${formatNumber(converter.stats.finalSpeedRatio)}.`;
  refs.kRange.textContent = `Range ${formatNumber(converter.stats.kMin)} to ${formatNumber(converter.stats.kMax)}`;
  refs.tRange.textContent = `Range ${formatNumber(converter.stats.tMin)} to ${formatNumber(converter.stats.tMax)}`;
}

function renderStats() {
  const converter = getSelectedConverter();
  if (!converter) return;

  const stats = [
    ["Converter", converter.name],
    ["Family", getSelectedFamily().name],
    ["Speed Ratio Points", converter.speedRatio.length],
    ["K-Factor Min", formatNumber(converter.stats.kMin)],
    ["K-Factor Max", formatNumber(converter.stats.kMax)],
    ["Torque Ratio Min", formatNumber(converter.stats.tMin)],
    ["Torque Ratio Max", formatNumber(converter.stats.tMax)],
    ["Stall Torque Ratio", formatNumber(converter.stats.stallTorqueRatio)],
  ];

  refs.converterStats.innerHTML = stats.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
}

function buildChart(canvas, label, labels, dataPoints, color) {
  return new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label,
          data: dataPoints,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.2,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#f6f1e7",
          },
        },
        tooltip: {
          backgroundColor: "#121212",
          borderColor: "rgba(255,255,255,0.18)",
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks: { color: "#b3ac9f" },
          grid: { color: "rgba(255,255,255,0.08)" },
          title: {
            display: true,
            text: "Speed Ratio",
            color: "#f6f1e7",
          },
        },
        y: {
          ticks: { color: "#b3ac9f" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    },
  });
}

function renderCharts() {
  const converter = getSelectedConverter();
  if (!converter) return;

  if (state.charts.kFactor) state.charts.kFactor.destroy();
  if (state.charts.torqueRatio) state.charts.torqueRatio.destroy();

  state.charts.kFactor = buildChart(refs.kFactorCanvas, converter.name, converter.speedRatio, converter.kFactor, "#d64031");
  state.charts.torqueRatio = buildChart(
    refs.torqueRatioCanvas,
    converter.name,
    converter.speedRatio,
    converter.torqueRatio,
    "#d9b167"
  );
}

function renderPrevNext() {
  const visible = getVisibleConverters();
  const currentIndex = visible.findIndex((converter) => converter.id === state.selectedConverterId);
  const previous = visible[currentIndex - 1];
  const next = visible[currentIndex + 1];

  refs.prevConverter.disabled = !previous;
  refs.nextConverter.disabled = !next;
  refs.prevConverter.onclick = previous ? () => setSelection(state.selectedFamilyId, previous.id) : null;
  refs.nextConverter.onclick = next ? () => setSelection(state.selectedFamilyId, next.id) : null;
}

function render() {
  renderFamilyNav();
  renderConverterList();
  renderHeader();
  renderStats();
  renderCharts();
  renderPrevNext();
}

function calculateKFactor(torque, engineSpeed) {
  return engineSpeed / Math.sqrt(torque);
}

function calculateTorque(kFactor, engineSpeed) {
  return Math.pow(engineSpeed / kFactor, 2);
}

function calculateEngineSpeed(kFactor, torque) {
  return kFactor * Math.sqrt(torque);
}

function convertKFactor(initialDiameter, newDiameter, knownKFactor) {
  return knownKFactor * Math.pow(initialDiameter / newDiameter, 2.5);
}

function initCalculators() {
  document.querySelectorAll(".calc-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const output = form.querySelector("output");
      const fields = Object.fromEntries(new FormData(form).entries());

      try {
        let result;
        if (form.dataset.calc === "kfactor") {
          result = calculateKFactor(Number(fields.torque), Number(fields.engineSpeed));
          output.textContent = `K-Factor = ${formatNumber(result)}`;
        } else if (form.dataset.calc === "torque") {
          result = calculateTorque(Number(fields.kFactor), Number(fields.engineSpeed));
          output.textContent = `Torque = ${formatNumber(result)} Nm`;
        } else if (form.dataset.calc === "enginespeed") {
          result = calculateEngineSpeed(Number(fields.kFactor), Number(fields.torque));
          output.textContent = `Engine Speed = ${formatNumber(result)} rpm`;
        } else {
          result = convertKFactor(
            Number(fields.initialDiameter),
            Number(fields.newDiameter),
            Number(fields.knownKFactor)
          );
          output.textContent = `Converted K-Factor = ${formatNumber(result)}`;
        }

        if (!Number.isFinite(result)) throw new Error("Calculation failed");
      } catch (error) {
        output.textContent = "Enter valid numeric values.";
      }
    });
  });
}

function initSearch() {
  refs.converterSearch.addEventListener("input", (event) => {
    state.searchTerm = event.target.value;
    renderConverterList();
    renderHeader();
    renderStats();
    renderCharts();
    renderPrevNext();
  });
}

function initCounts() {
  refs.familyCount.textContent = state.families.length;
  refs.converterCount.textContent = state.families.reduce((sum, family) => sum + family.converters.length, 0);
}

function initState() {
  const route = parseRoute();
  const defaultFamily = state.families.find((family) => family.id === route.family) || state.families[0];
  const defaultConverter =
    defaultFamily.converters.find((converter) => converter.id === route.converter) || defaultFamily.converters[0];

  state.selectedFamilyId = defaultFamily.id;
  state.selectedConverterId = defaultConverter.id;
}

async function init() {
  await loadData();
  initCounts();
  initState();
  initSearch();
  initCalculators();
  render();
}

init().catch((error) => {
  console.error(error);
  refs.converterTitle.textContent = "Unable to load converter data";
  refs.converterMeta.textContent = "Check that data.js is present in the deployed site.";
});
