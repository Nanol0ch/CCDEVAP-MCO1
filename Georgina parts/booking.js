/*
 * booking.js  –  Ravelo / Booking & Reservation System
 * SkyLink Airlines – CCDEVAP MCO1
 *
 * Covers:
 *  - Multi-step wizard (steps 1–3)
 *  - Passenger info form + inline validation
 *  - Meal selection (dynamic price update)
 *  - Interactive seat map (available / occupied / premium / selected)
 *  - Extra services (baggage qty, priority toggle, insurance, lounge)
 *  - Real-time booking summary sidebar
 *  - Toast notifications
 *  - Confirm booking modal with reference number
 */

$(function () {

  /* ──────────────────────────────────────────
     CONSTANTS / STATE
  ────────────────────────────────────────── */

  const TAXES = 680;

  // ── Load flight from URL param ──────────────────────────────
  const urlParams  = new URLSearchParams(window.location.search);
  const flightId   = parseInt(urlParams.get('flightId'));
  const flight     = (typeof flights !== 'undefined' && flightId)
                       ? flights.find(f => f.id === flightId) || null
                       : null;
  const BASE_FARE  = flight ? flight.price : 0;

  const MEALS = [
    { id: 'standard',   label: 'Standard',     icon: '🍽️', price: 0,   desc: 'Included meal with your ticket.' },
    { id: 'vegetarian', label: 'Vegetarian',   icon: '🥗', price: 150, desc: 'Fresh plant-based meal.' },
    { id: 'vegan',      label: 'Vegan',        icon: '🌱', price: 150, desc: 'No animal products whatsoever.' },
    { id: 'halal',      label: 'Halal',        icon: '☪️', price: 100, desc: 'Certified Halal-prepared meal.' },
    { id: 'kosher',     label: 'Kosher',       icon: '✡️', price: 200, desc: 'Prepared under Kosher supervision.' },
    { id: 'gluten',     label: 'Gluten-Free',  icon: '🌾', price: 180, desc: 'Safe for gluten intolerance.' },
  ];

  /* Seat map definition
     R = row, C = column letters A B | C D E | F G
     P = premium, O = occupied, A = available
  */
  const ROWS         = 10;
  const COLS         = ['A','B','C','D','E','F'];
  const PREMIUM_ROWS = [1, 2];
  const TOTAL_SEATS  = ROWS * COLS.length;   // 60

  // Build a shuffled seat list seeded by flightId so each flight
  // has a consistent, unique occupied pattern.
  function buildOccupiedSeats(availableCount, seed) {
    const all = [];
    for (let r = 1; r <= ROWS; r++) {
      COLS.forEach(function (c) { all.push(r + c); });
    }
    // Seeded Fisher-Yates shuffle (deterministic per flight)
    let s = seed || 1;
    function rand() { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; }
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const occupiedCount = Math.max(0, TOTAL_SEATS - availableCount);
    return all.slice(0, occupiedCount);
  }

  const OCCUPIED = buildOccupiedSeats(
    flight ? flight.seats : TOTAL_SEATS,
    flightId || 1
  );

  let state = {
    currentStep : 1,
    meal        : { id: 'standard', label: 'Standard', price: 0 },
    seat        : null,      // e.g. { label:'3D', premium:false }
    baggage     : 0,
    priority    : false,
    insurance   : false,
    lounge      : false,
    pendingSeat : null,      // seat being previewed in modal
    counts      : { adult: 1, child: 0, infant: 0 },
    passengers  : [],        // [{ key, type, label, gender, firstName, lastName, nationality, dob, docType, docNumber, docExpiry, expanded }]
  };

  const NATIONALITY_OPTIONS = [
    { value: 'PH', label: 'Philippines' },
    { value: 'US', label: 'United States' },
    { value: 'JP', label: 'Japan' },
    { value: 'SG', label: 'Singapore' },
    { value: 'AU', label: 'Australia' },
    { value: 'GB', label: 'United Kingdom' },
    { value: 'KR', label: 'South Korea' },
    { value: 'CN', label: 'China' },
    { value: 'IN', label: 'India' },
    { value: 'OTHER', label: 'Other' },
  ];

  const DOC_TYPE_OPTIONS = [
    { value: 'passport', label: 'Passport' },
    { value: 'national_id', label: 'National ID' },
    { value: 'drivers_license', label: "Driver's License" },
  ];

  /* ──────────────────────────────────────────
     TOOLTIPS (Bootstrap)
  ────────────────────────────────────────── */
  $('[data-bs-toggle="tooltip"]').each(function () {
    new bootstrap.Tooltip(this);
  });

  /* ──────────────────────────────────────────
     PASSENGER COUNT CONTROLS
  ────────────────────────────────────────── */
  function syncCountDisplay() {
    $('#adultCount').text(state.counts.adult);
    $('#childCount').text(state.counts.child);
    $('#infantCount').text(state.counts.infant);
  }

  $('#adultPlus').on('click', function () {
    state.counts.adult++;
    syncCountDisplay();
    rebuildPassengerList();
    updateTotal();
  });

  $('#adultMinus').on('click', function () {
    if (state.counts.adult > 1) {
      state.counts.adult--;
      syncCountDisplay();
      rebuildPassengerList();
      updateTotal();
    }
  });

  $('#childPlus').on('click', function () {
    state.counts.child++;
    syncCountDisplay();
    rebuildPassengerList();
    updateTotal();
  });

  $('#childMinus').on('click', function () {
    if (state.counts.child > 0) {
      state.counts.child--;
      syncCountDisplay();
      rebuildPassengerList();
      updateTotal();
    }
  });

  $('#infantPlus').on('click', function () {
    if (state.counts.infant < state.counts.adult) {
      state.counts.infant++;
      syncCountDisplay();
      rebuildPassengerList();
      updateTotal();
    } else {
      showToast('Infants cannot exceed the number of adults.', 'warning');
    }
  });

  $('#infantMinus').on('click', function () {
    if (state.counts.infant > 0) {
      state.counts.infant--;
      syncCountDisplay();
      rebuildPassengerList();
      updateTotal();
    }
  });

  /* ──────────────────────────────────────────
     PASSENGER LIST (rebuilt whenever counts change)
     Preserves already-entered data for passengers that still exist.
  ────────────────────────────────────────── */
  function rebuildPassengerList() {
    const newList = [];
    const types = [
      { type: 'adult',  label: 'Adult',  count: state.counts.adult,  hint: 'Adult must be 12 years and above' },
      { type: 'child',  label: 'Child',  count: state.counts.child,  hint: 'Child must be between 2 and 11 years' },
      { type: 'infant', label: 'Infant', count: state.counts.infant, hint: 'Infant must be under 2 years (travels on lap)' },
    ];

    types.forEach(function (group) {
      for (let i = 1; i <= group.count; i++) {
        const key = group.type + i;
        // Reuse existing data if this passenger slot already existed
        const existing = state.passengers.find(p => p.key === key);
        newList.push(existing || {
          key         : key,
          type        : group.type,
          label       : group.label + ' ' + i,
          hint        : group.hint,
          gender      : '',
          firstName   : '',
          lastName    : '',
          nationality : 'PH',
          dob         : '',
          docType     : 'passport',
          docNumber   : '',
          docExpiry   : '',
          expanded    : false,
        });
      }
    });

    // First passenger expanded by default if nothing else is expanded
    if (newList.length > 0 && !newList.some(p => p.expanded)) {
      newList[0].expanded = true;
    }

    state.passengers = newList;
    renderPassengerCards();
  }

  /* ──────────────────────────────────────────
     PASSENGER CARD STATUS
  ────────────────────────────────────────── */
  function getPassengerStatus(p) {
    const requiredFilled = p.gender && p.firstName.trim() && p.lastName.trim() &&
                            p.nationality && p.dob && p.docNumber.trim() && p.docExpiry;
    if (requiredFilled) return 'complete';
    const anyFilled = p.gender || p.firstName.trim() || p.lastName.trim() ||
                       p.dob || p.docNumber.trim() || p.docExpiry;
    return anyFilled ? 'incomplete' : 'to-complete';
  }

  function statusBadgeHtml(status) {
    if (status === 'complete')   return '<span class="passenger-status-badge complete"><i class="bi bi-check-circle me-1"></i>Complete</span>';
    if (status === 'incomplete') return '<span class="passenger-status-badge incomplete">Incomplete</span>';
    return '<span class="passenger-status-badge to-complete">To Complete</span>';
  }

  function passengerIcon(type) {
    if (type === 'child')  return 'bi-person';
    if (type === 'infant') return 'bi-person-heart';
    return 'bi-person-fill';
  }

  /* ──────────────────────────────────────────
     RENDER PASSENGER CARDS
  ────────────────────────────────────────── */
  function renderPassengerCards() {
    const $container = $('#passengerCardsContainer');
    $container.empty();

    state.passengers.forEach(function (p) {
      const status = getPassengerStatus(p);
      const natOptions = NATIONALITY_OPTIONS.map(n =>
        `<option value="${n.value}" ${p.nationality === n.value ? 'selected' : ''}>${n.label}</option>`
      ).join('');
      const docOptions = DOC_TYPE_OPTIONS.map(d =>
        `<option value="${d.value}" ${p.docType === d.value ? 'selected' : ''}>${d.label}</option>`
      ).join('');

      const $card = $(`
        <div class="passenger-card ${p.expanded ? 'expanded' : ''}" data-key="${p.key}">
          <div class="passenger-card-header">
            <div class="passenger-card-title">
              <i class="bi ${passengerIcon(p.type)}"></i>
              <span>${p.label}</span>
            </div>
            <div class="passenger-card-status">
              ${statusBadgeHtml(status)}
              <i class="bi bi-chevron-up passenger-card-chevron"></i>
            </div>
          </div>
          <div class="passenger-card-body" style="${p.expanded ? '' : 'display:none;'}">
            <div class="passenger-card-hint">${p.hint}</div>

            <div class="gender-toggle">
              <button type="button" class="gender-btn ${p.gender === 'M' ? 'active' : ''}" data-gender="M">Male</button>
              <button type="button" class="gender-btn ${p.gender === 'F' ? 'active' : ''}" data-gender="F">Female</button>
            </div>

            <div class="row g-3">
              <div class="col-md-6">
                <input type="text" class="form-control pax-field" data-field="firstName"
                       value="${p.firstName}" placeholder="First/Given name"/>
              </div>
              <div class="col-md-6">
                <input type="text" class="form-control pax-field" data-field="lastName"
                       value="${p.lastName}" placeholder="Family name/Surname"/>
              </div>
              <div class="col-md-6">
                <label class="form-label small text-muted mb-1">Nationality/Region</label>
                <select class="form-select pax-field" data-field="nationality">${natOptions}</select>
              </div>
              <div class="col-md-6">
                <label class="form-label small text-muted mb-1">Date of birth</label>
                <input type="date" class="form-control pax-field" data-field="dob" value="${p.dob}"/>
              </div>
            </div>

            <div class="mt-3">
              <label class="form-label fw-semibold small">Travel document type</label>
              <div class="row g-3">
                <div class="col-md-4">
                  <select class="form-select pax-field" data-field="docType">${docOptions}</select>
                </div>
                <div class="col-md-4">
                  <input type="text" class="form-control pax-field" data-field="docNumber"
                         value="${p.docNumber}" placeholder="Passport/ID number"/>
                </div>
                <div class="col-md-4">
                  <input type="date" class="form-control pax-field" data-field="docExpiry"
                         value="${p.docExpiry}" placeholder="Expiry date"/>
                </div>
              </div>
            </div>
          </div>
        </div>
      `);

      $container.append($card);
    });
  }

  /* ──────────────────────────────────────────
     PASSENGER CARD INTERACTIONS (delegated)
  ────────────────────────────────────────── */
  $(document).on('click', '.passenger-card-header', function () {
    const $card = $(this).closest('.passenger-card');
    const key   = $card.data('key');
    const p     = state.passengers.find(x => x.key === key);
    if (!p) return;
    p.expanded = !p.expanded;
    $card.toggleClass('expanded', p.expanded);
    $card.find('.passenger-card-body').slideToggle(150);
  });

  $(document).on('click', '.gender-btn', function (e) {
    e.stopPropagation();
    const $card = $(this).closest('.passenger-card');
    const key   = $card.data('key');
    const p     = state.passengers.find(x => x.key === key);
    if (!p) return;
    p.gender = $(this).data('gender');
    $card.find('.gender-btn').removeClass('active');
    $(this).addClass('active');
    refreshCardStatus($card, p);
  });

  $(document).on('input change', '.pax-field', function (e) {
    e.stopPropagation();
    const $card = $(this).closest('.passenger-card');
    const key   = $card.data('key');
    const p     = state.passengers.find(x => x.key === key);
    if (!p) return;
    const field = $(this).data('field');
    p[field] = $(this).val();
    refreshCardStatus($card, p);
  });

  // Prevent clicks inside the body from bubbling up and toggling the card
  $(document).on('click', '.passenger-card-body', function (e) {
    e.stopPropagation();
  });

  function refreshCardStatus($card, p) {
    const status = getPassengerStatus(p);
    $card.find('.passenger-card-status').html(statusBadgeHtml(status) + '<i class="bi bi-chevron-up passenger-card-chevron"></i>');
  }

  /* ──────────────────────────────────────────
     STEP NAVIGATION
  ────────────────────────────────────────── */
  function goToStep(n) {
    state.currentStep = n;
    $('.booking-step').addClass('d-none');
    $('#step' + n).removeClass('d-none');

    // Update stepper UI
    $('.step').each(function (i) {
      const stepNum = i + 1;  // steps are steps 1,2,3 but stepper has 4 dots
      // re-map: stepper dot index vs wizard step
    });
    updateStepper(n);

    // Progress bar
    const pct = Math.round(((n - 1) / 3) * 100) + 33;
    const safe = Math.min(pct, 100);
    $('#progressBar').css('width', safe + '%');
    $('#progressPct').text(safe + '%');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateStepper(activeStep) {
    // Stepper has 4 circles: 1=Select Flight(always done), 2=Passenger, 3=Seat&Extras, 4=Review
    // Our wizard: step1=Passenger(stepper2), step2=Seat(stepper3), step3=Review(stepper4)
    const stepperMap = { 1: 2, 2: 3, 3: 4 };
    const active = stepperMap[activeStep];

    $('.step').each(function (i) {
      const dot = i + 1;
      const $circle = $(this).find('.step-circle');
      $(this).removeClass('active completed');
      if (dot < active) {
        $(this).addClass('completed');
        $circle.html('<i class="bi bi-check-lg"></i>');
      } else if (dot === active) {
        $(this).addClass('active');
        $circle.text(dot);
      } else {
        $circle.text(dot);
      }
    });

    // Connectors
    $('.step-connector').each(function (i) {
      if (i < active - 1) {
        $(this).addClass('completed');
      } else {
        $(this).removeClass('completed');
      }
    });
  }

  /* ──────────────────────────────────────────
     FORM VALIDATION
  ────────────────────────────────────────── */
  function validateStep1() {
    let valid = true;
    const fields = ['email', 'contact', 'emergencyName', 'emergencyContact'];

    fields.forEach(function (id) {
      const $el = $('#' + id);
      if (!$el.val().trim()) {
        $el.addClass('is-invalid');
        valid = false;
      } else {
        $el.removeClass('is-invalid').addClass('is-valid');
      }
    });

    // Email format check
    const email = $('#email').val();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      $('#email').addClass('is-invalid');
      valid = false;
    }

    // Validate every passenger card; expand the first incomplete one
    let firstIncompleteKey = null;
    state.passengers.forEach(function (p) {
      const status = getPassengerStatus(p);
      if (status !== 'complete') {
        valid = false;
        if (!firstIncompleteKey) firstIncompleteKey = p.key;
      }
    });

    if (firstIncompleteKey) {
      state.passengers.forEach(function (p) {
        p.expanded = (p.key === firstIncompleteKey);
      });
      renderPassengerCards();
    }

    return valid;
  }

  // Clear validation on input
  $('input, select').on('input change', function () {
    if ($(this).val()) {
      $(this).removeClass('is-invalid').addClass('is-valid');
    }
  });

  /* ──────────────────────────────────────────
     STEP 1 → STEP 2
  ────────────────────────────────────────── */
  $('#btnStep1Next').on('click', function () {
    if (!validateStep1()) {
      showToast('Please complete all passenger and contact details.', 'danger');
      return;
    }
    // Update summary passenger info
    updatePassengerSummary();
    showToast('Passenger info saved!', 'success');
    goToStep(2);
  });

  function updatePassengerSummary() {
    const total = state.passengers.length;
    if (total === 0) {
      $('#summPassenger').text('—');
      return;
    }
    const lead = state.passengers[0];
    const leadName = (lead.firstName + ' ' + lead.lastName).trim() || '—';
    const extra = total > 1 ? ' (+' + (total - 1) + ' more)' : '';
    $('#summPassenger').text(leadName + extra);
  }

  /* ──────────────────────────────────────────
     MEAL CARDS
  ────────────────────────────────────────── */
  function buildMealCards() {
    const $container = $('#mealOptions');
    $container.empty();

    MEALS.forEach(function (meal) {
      const costLabel = meal.price === 0 ? '<span class="text-success fw-semibold">Included</span>'
                                         : '<span class="fw-semibold">+₱' + meal.price + '</span>';
      const selected  = state.meal.id === meal.id ? ' selected' : '';
      const $col = $('<div class="col-md-4 col-6"></div>');
      const $card = $(`
        <div class="meal-card${selected}" data-meal-id="${meal.id}">
          <div class="meal-icon mb-1">${meal.icon}</div>
          <div class="fw-semibold small">${meal.label}</div>
          <div class="text-muted" style="font-size:.75rem;">${meal.desc}</div>
          <div class="mt-2">${costLabel}</div>
        </div>
      `);
      $col.append($card);
      $container.append($col);
    });

    // Click handler
    $container.off('click', '.meal-card').on('click', '.meal-card', function () {
      const mealId = $(this).data('meal-id');
      const meal   = MEALS.find(m => m.id === mealId);
      state.meal   = meal;
      $('.meal-card').removeClass('selected');
      $(this).addClass('selected');
      $('#summMeal').text(meal.label);
      updateTotal();
      showToast(meal.label + ' meal selected.', 'primary');
    });
  }

  /* ──────────────────────────────────────────
     SEAT MAP
  ────────────────────────────────────────── */
  function buildSeatMap() {
    const $map = $('#seatMap');
    $map.empty();

    // Column headers
    const $header = $('<div class="seat-row"></div>');
    $header.append('<div class="seat-row-label"></div>');
    COLS.forEach(function (col, i) {
      if (i === 3) $header.append('<div class="aisle"></div>');
      $header.append('<div style="width:36px;text-align:center;font-weight:700;font-size:.75rem;color:#64748b;">' + col + '</div>');
    });
    $map.append($header);

    for (let r = 1; r <= ROWS; r++) {
      const $row = $('<div class="seat-row"></div>');
      $row.append('<div class="seat-row-label">' + r + '</div>');

      COLS.forEach(function (col, i) {
        if (i === 3) $row.append('<div class="aisle"></div>');

        const seatId   = r + col;
        const isPrem   = PREMIUM_ROWS.includes(r);
        const isOccup  = OCCUPIED.includes(seatId);
        const isSel    = state.seat && state.seat.label === seatId;

        let cls = 'seat-btn ';
        if (isOccup) cls += 'occupied';
        else if (isSel) cls += 'selected-seat';
        else if (isPrem) cls += 'premium';
        else cls += 'available';

        const $btn = $('<button class="' + cls + '" data-seat="' + seatId + '" data-premium="' + isPrem + '" data-occupied="' + isOccup + '">' + seatId + '</button>');
        $row.append($btn);
      });

      $map.append($row);
    }

    // Click on seat
    $map.off('click', '.seat-btn').on('click', '.seat-btn', function () {
      const seatId  = $(this).data('seat');
      const isOccup = $(this).data('occupied');
      const isPrem  = $(this).data('premium');

      if (isOccup) {
        showToast('Seat ' + seatId + ' is already occupied.', 'danger');
        return;
      }

      // Show detail modal
      state.pendingSeat = { label: seatId, premium: isPrem };
      $('#seatModalBody').html(`
        <div class="text-center py-2">
          <div style="font-size:2.5rem;">💺</div>
          <h5 class="mt-2">Seat <strong>${seatId}</strong></h5>
          <span class="badge ${isPrem ? 'bg-warning text-dark' : 'bg-success'}">${isPrem ? 'Premium (+₱500)' : 'Standard'}</span>
          <p class="text-muted small mt-2 mb-0">Row ${seatId.slice(0,-1)}, Column ${seatId.slice(-1)}</p>
          <p class="text-muted small">${isPrem ? 'Extra legroom, priority boarding zone.' : 'Standard economy seat.'}</p>
        </div>
      `);
      new bootstrap.Modal('#seatModal').show();
    });
  }

  // Seat modal confirm
  $('#seatModalSelect').on('click', function () {
    if (!state.pendingSeat) return;
    state.seat = state.pendingSeat;
    $('#selectedSeatLabel').text('Seat: ' + state.seat.label).removeClass('bg-secondary').addClass('bg-primary');
    $('#summSeat').text(state.seat.label + (state.seat.premium ? ' (Premium)' : ''));
    updateTotal();
    bootstrap.Modal.getInstance('#seatModal').hide();
    buildSeatMap(); // re-render to show selection
    showToast('Seat ' + state.seat.label + ' selected!', 'success');
  });

  /* ──────────────────────────────────────────
     EXTRA SERVICES
  ────────────────────────────────────────── */

  // Baggage
  $('#baggagePlus').on('click', function () {
    if (state.baggage < 3) {
      state.baggage++;
      $('#baggageCount').text(state.baggage);
      $('#baggageCostBadge').text('₱' + (state.baggage * 500));
      updateTotal();
    } else {
      showToast('Maximum 3 extra bags allowed.', 'warning');
    }
  });
  $('#baggageMinus').on('click', function () {
    if (state.baggage > 0) {
      state.baggage--;
      $('#baggageCount').text(state.baggage);
      $('#baggageCostBadge').text('₱' + (state.baggage * 500));
      updateTotal();
    }
  });

  // Priority toggle
  $('#priorityToggle').on('change', function () {
    state.priority = $(this).is(':checked');
    $('#priorityCard').toggleClass('active-extra', state.priority);
    updateTotal();
  });

  // Insurance
  $('#insuranceCheck').on('change', function () {
    state.insurance = $(this).is(':checked');
    $('#insuranceCard').toggleClass('active-extra', state.insurance);
    updateTotal();
  });

  // Lounge
  $('#loungeCheck').on('change', function () {
    state.lounge = $(this).is(':checked');
    $('#loungeCard').toggleClass('active-extra', state.lounge);
    updateTotal();
  });

  /* ──────────────────────────────────────────
     TOTAL CALCULATION
  ────────────────────────────────────────── */
  function updateTotal() {
    // Paying passengers: adults + children (infants travel free on lap)
    const payingPax = state.counts.adult + state.counts.child;
    const totalPax  = state.counts.adult + state.counts.child + state.counts.infant;

    // Update sidebar passenger count label
    const paxParts = [];
    if (state.counts.adult  > 0) paxParts.push(state.counts.adult  + ' Adult'  + (state.counts.adult  > 1 ? 's' : ''));
    if (state.counts.child  > 0) paxParts.push(state.counts.child  + ' Child'  + (state.counts.child  > 1 ? 'ren' : ''));
    if (state.counts.infant > 0) paxParts.push(state.counts.infant + ' Infant' + (state.counts.infant > 1 ? 's' : ''));
    $('#summPassengerCount').text(paxParts.join(', ') || '1 Adult');

    // Base fare × paying passengers
    const fareCost = BASE_FARE * payingPax;
    $('#summBase').text('₱' + fareCost.toLocaleString());
    $('#summBaseLabel').text('Base Fare ×' + payingPax);

    let total = fareCost + TAXES;

    // Meal (per paying passenger)
    const mealCost = state.meal.price * payingPax;
    total += mealCost;
    if (mealCost > 0) {
      $('#summMealRow').show();
      $('#summMealCost').text('₱' + mealCost.toLocaleString());
    } else {
      $('#summMealRow').hide();
    }

    // Seat
    const seatCost = state.seat && state.seat.premium ? 500 : 0;
    total += seatCost;
    if (seatCost > 0) {
      $('#summSeatRow').show();
      $('#summSeatCost').text('₱' + seatCost);
    } else {
      $('#summSeatRow').hide();
    }

    // Baggage
    const baggageCost = state.baggage * 500;
    total += baggageCost;
    if (baggageCost > 0) {
      $('#summBaggageRow').show();
      $('#summBaggageCost').text('₱' + baggageCost.toLocaleString());
    } else {
      $('#summBaggageRow').hide();
    }

    // Priority
    if (state.priority) { total += 300; $('#summPriorityRow').show(); } else { $('#summPriorityRow').hide(); }

    // Insurance
    if (state.insurance) { total += 450; $('#summInsuranceRow').show(); } else { $('#summInsuranceRow').hide(); }

    // Lounge
    if (state.lounge) { total += 1200; $('#summLoungeRow').show(); } else { $('#summLoungeRow').hide(); }

    $('#grandTotal').text('₱' + total.toLocaleString());
  }

  /* ──────────────────────────────────────────
     STEP 2 → STEP 3 (Review)
  ────────────────────────────────────────── */
  $('#btnStep2Next').on('click', function () {
    if (!state.seat) {
      showToast('Please select a seat to continue.', 'warning');
      return;
    }
    buildReview();
    goToStep(3);
  });

  $('#btnStep2Back').on('click', function () { goToStep(1); });

  function buildReview() {
    const email      = $('#email').val();
    const seat       = state.seat ? state.seat.label + (state.seat.premium ? ' (Premium)' : '') : 'None';
    const meal       = state.meal.label;
    const baggage    = state.baggage + ' extra bag(s)';
    const priority   = state.priority ? 'Yes' : 'No';
    const insurance  = state.insurance ? 'Yes' : 'No';
    const lounge     = state.lounge ? 'Yes' : 'No';
    const total      = $('#grandTotal').text();

    const passengerRows = state.passengers.map(function (p) {
      const genderLabel = p.gender === 'M' ? 'Male' : (p.gender === 'F' ? 'Female' : '—');
      return `<tr><td class="text-muted">${p.label}</td><td>${(p.firstName + ' ' + p.lastName).trim()} &nbsp;<span class="text-muted small">(${genderLabel})</span></td></tr>`;
    }).join('');

    const html = `
      <table class="table table-bordered review-table mb-0">
        <tbody>
          <tr><td class="text-muted">Flight</td><td><strong>${flight ? flight.flightNumber + ' \u00b7 ' + flight.origin + ' \u2192 ' + flight.destination : 'N/A'}</strong></td></tr>
          ${passengerRows}
          <tr><td class="text-muted">Email</td><td>${email}</td></tr>
          <tr><td class="text-muted">Seat</td><td>${seat}</td></tr>
          <tr><td class="text-muted">Meal</td><td>${meal}</td></tr>
          <tr><td class="text-muted">Extra Baggage</td><td>${baggage}</td></tr>
          <tr><td class="text-muted">Priority Boarding</td><td>${priority}</td></tr>
          <tr><td class="text-muted">Travel Insurance</td><td>${insurance}</td></tr>
          <tr><td class="text-muted">Lounge Access</td><td>${lounge}</td></tr>
          <tr class="table-primary"><td><strong>Total</strong></td><td><strong>${total}</strong></td></tr>
        </tbody>
      </table>
    `;
    $('#reviewContent').html(html);
  }

  $('#btnStep3Back').on('click', function () { goToStep(2); });

  /* ──────────────────────────────────────────
     CONFIRM BOOKING
  ────────────────────────────────────────── */
  $('#btnConfirm').on('click', function () {
    // Generate random reference
    const ref = 'SKY-' + Math.floor(100000 + Math.random() * 900000);
    $('#bookingRef').text(ref);

    // Progress to 100%
    $('#progressBar').css('width', '100%');
    $('#progressPct').text('100%');

    new bootstrap.Modal('#successModal').show();
  });

  /* ──────────────────────────────────────────
     POPULATE FLIGHT INFO (banner + sidebar)
  ────────────────────────────────────────── */
  function populateFlightInfo() {
    if (!flight) return;

    const routeShort = flight.origin + ' \u2192 ' + flight.destination;
    const timeRange  = flight.departure + ' \u2192 ' + flight.arrival;
    const stopsLabel = flight.stops === 0
      ? '<span class="badge bg-success">Direct</span>'
      : '<span class="badge bg-warning text-dark">' + flight.stops + ' stop(s)</span>';

    // ── Banner ──────────────────────────────────────────────────
    $('#bannerOrigin').text(flight.origin);
    $('#bannerDestination').text(flight.destination);
    $('#bannerDateTime').html(
      '<i class="bi bi-clock me-1"></i>' + timeRange +
      ' &nbsp;|&nbsp; <i class="bi bi-signpost-2 me-1"></i>' + flight.duration +
      ' &nbsp;|&nbsp; ' + stopsLabel
    );
    $('#bannerFlightInfo').text(flight.flightNumber + ' \u00b7 ' + flight.airline);

    // ── Seat availability badge ──────────────────────────────────
    const seatsBadgeClass = flight.seats <= 5 ? 'bg-danger' : 'bg-success';
    $('#seatsAvailableBadge')
      .text(flight.seats + ' seat' + (flight.seats !== 1 ? 's' : '') + ' available')
      .removeClass('bg-danger bg-success bg-light text-dark')
      .addClass(seatsBadgeClass);

    // ── Sidebar summary ─────────────────────────────────────────
    $('#summFlight').text(flight.flightNumber + ' \u00b7 ' + routeShort);
    $('#summDateTime').text(flight.departure + '\u2013' + flight.arrival + ' \u00b7 ' + flight.duration);
    $('#summBase').text('\u20b1' + flight.price.toLocaleString());
  }

  /* ──────────────────────────────────────────
     TOAST HELPER
  ────────────────────────────────────────── */
  function showToast(message, type) {
    type = type || 'primary';
    const colorMap = {
      success : 'bg-success',
      danger  : 'bg-danger',
      warning : 'bg-warning text-dark',
      primary : 'bg-primary',
      info    : 'bg-info text-dark',
    };
    const bgClass = colorMap[type] || 'bg-primary';
    const $toast = $('#liveToast');
    $toast.removeClass('bg-success bg-danger bg-warning bg-primary bg-info text-dark').addClass(bgClass);
    $('#toastMsg').text(message);
    bootstrap.Toast.getOrCreateInstance($toast[0]).show();
  }

  /* ──────────────────────────────────────────
     INIT
  ────────────────────────────────────────── */
  populateFlightInfo();
  syncCountDisplay();
  rebuildPassengerList();
  buildMealCards();
  buildSeatMap();
  updateTotal();
  goToStep(1);

});
