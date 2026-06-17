$(document).ready(function() {

    // Trip Type Toggle
    $("#oneWayBtn").click(function() {
        $("#returnDateSection").hide();
        $("#oneWayBtn").css("background-color", "#0d6efd");
        $("#oneWayBtn").css("color", "white");
        $("#oneWayBtn").css("border-color", "#0d6efd");
        $("#roundTripBtn").css("background-color", "transparent");
        $("#roundTripBtn").css("color", "#0d6efd");
        $("#roundTripBtn").css("border-color", "#0d6efd");
    });

    $("#roundTripBtn").click(function() {
        $("#returnDateSection").show();
        $("#roundTripBtn").css("background-color", "#0d6efd");
        $("#roundTripBtn").css("color", "white");
        $("#roundTripBtn").css("border-color", "#0d6efd");
        $("#oneWayBtn").css("background-color", "transparent");
        $("#oneWayBtn").css("color", "#0d6efd");
        $("#oneWayBtn").css("border-color", "#0d6efd");
    });

    // Passenger Counters
    $("#adultPlus").click(function() {
        var count = parseInt($("#adultCount").text());
        $("#adultCount").text(count + 1);
    });

    $("#adultMinus").click(function() {
        var count = parseInt($("#adultCount").text());
        if (count > 1) {
            $("#adultCount").text(count - 1);
        }
    });

    $("#childPlus").click(function() {
        var count = parseInt($("#childCount").text());
        $("#childCount").text(count + 1);
    });

    $("#childMinus").click(function() {
        var count = parseInt($("#childCount").text());
        if (count > 0) {
            $("#childCount").text(count - 1);
        }
    });

    $("#infantPlus").click(function() {
        var count = parseInt($("#infantCount").text());
        $("#infantCount").text(count + 1);
    });

    $("#infantMinus").click(function() {
        var count = parseInt($("#infantCount").text());
        if (count > 0) {
            $("#infantCount").text(count - 1);
        }
    });

    // Price Slider
    $("#priceSlider").on("input", function() {
        var value = $(this).val();
        $("#priceSliderValue").text(value);
    });

    // Form Validation and Search Button
    $("#searchBtn").click(function() {

        var origin = $("#origin").val();
        var destination = $("#destination").val();
        var departureDate = $("#departureDate").val();
        var valid = true;

        if (origin == "") {
            $("#originError").show();
            valid = false;
        } else {
            $("#originError").hide();
        }

        if (destination == "") {
            $("#destinationError").show();
            valid = false;
        } else {
            $("#destinationError").hide();
        }

        if (origin == destination && origin != "") {
            $("#sameRouteError").show();
            valid = false;
        } else {
            $("#sameRouteError").hide();
        }

        if (departureDate == "") {
            $("#departureDateError").show();
            valid = false;
        } else {
            $("#departureDateError").hide();
        }

        var returnDate = $("#returnDate").val();
        var isRoundTrip = $("#returnDateSection").is(":visible");

        if (isRoundTrip && returnDate == "") {
            $("#returnDateError").show();
            valid = false;
        } else if (isRoundTrip && returnDate <= departureDate) {
            $("#returnDateError").show();
            valid = false;
        } else {
            $("#returnDateError").hide();
        }

        if (valid == true) {
            $("#resultsSection").show();
            renderFlights(flights);

            // Generate airline filters if not already done
            if ($("#airlineFilters").is(":empty")) {
                var airlines = [];
                for (var i = 0; i < flights.length; i++) {
                    if (airlines.indexOf(flights[i].airline) == -1) {
                        airlines.push(flights[i].airline);
                    }
                }
                for (var i = 0; i < airlines.length; i++) {
                    $("#airlineFilters").append(
                        "<div class='form-check'>" +
                        "<input class='form-check-input filter-airline' type='checkbox' value='" + airlines[i] + "' id='airline" + i + "'>" +
                        "<label class='form-check-label' for='airline" + i + "'> " + airlines[i] + " </label>" +
                        "</div>"
                    );
                }
            }

            var toast = new bootstrap.Toast(document.getElementById("searchToast"));
            $("#toastMessage").text("Flights loaded successfully!");
            $("#searchToast").addClass("bg-success");
            toast.show();
        }

    });

    // Sort Flights
    $("#sortSelect").change(function() {

        var sortBy = $("#sortSelect").val();

        if (sortBy == "price") {
            flights.sort(function(a, b) {
                return a.price - b.price;
            });
        }

        if (sortBy == "departure") {
            flights.sort(function(a, b) {
                return a.departure > b.departure ? 1 : -1;
            });
        }

        if (sortBy == "duration") {
            flights.sort(function(a, b) {
                return a.durationMins - b.durationMins;
            });
        }

        renderFlights(flights);

    });

    // Filter Flights
    function applyFilters() {

        var filtered = [];

        for (var i = 0; i < flights.length; i++) {

            var flight = flights[i];
            var show = true;

            // Price Filter
            var selectedPrices = [];
            $(".filter-price:checked").each(function() {
                selectedPrices.push($(this).val());
            });

            if (selectedPrices.length > 0) {
                var inPrice = false;
                for (var j = 0; j < selectedPrices.length; j++) {
                    var range = selectedPrices[j].split("-");
                    if (flight.price >= parseInt(range[0]) && flight.price <= parseInt(range[1])) {
                        inPrice = true;
                    }
                }
                if (inPrice == false) {
                    show = false;
                }
            }

            // Schedule Filter
            var selectedSchedules = [];
            $(".filter-schedule:checked").each(function() {
                selectedSchedules.push($(this).val());
            });

            if (selectedSchedules.length > 0) {
                var inSchedule = false;
                var hour = parseInt(flight.departure.split(":")[0]);

                for (var m = 0; m < selectedSchedules.length; m++) {
                    if (selectedSchedules[m] == "morning" && hour >= 5 && hour < 12) {
                        inSchedule = true;
                    }
                    if (selectedSchedules[m] == "afternoon" && hour >= 12 && hour < 18) {
                        inSchedule = true;
                    }
                    if (selectedSchedules[m] == "evening" && hour >= 18 && hour < 24) {
                        inSchedule = true;
                    }
                    if (selectedSchedules[m] == "night" && hour >= 0 && hour < 5) {
                        inSchedule = true;
                    }
                }

                if (inSchedule == false) {
                    show = false;
                }
            }

            // Airline Filter
            var selectedAirlines = [];
            $(".filter-airline:checked").each(function() {
                selectedAirlines.push($(this).val());
            });

            if (selectedAirlines.length > 0) {
                var inAirline = false;
                for (var n = 0; n < selectedAirlines.length; n++) {
                    if (flight.airline == selectedAirlines[n]) {
                        inAirline = true;
                    }
                }
                if (inAirline == false) {
                    show = false;
                }
            }

            // Stops Filter
            var selectedStops = [];
            $(".filter-stops:checked").each(function() {
                selectedStops.push(parseInt($(this).val()));
            });

            if (selectedStops.length > 0) {
                var inStops = false;
                for (var k = 0; k < selectedStops.length; k++) {
                    if (flight.stops == selectedStops[k]) {
                        inStops = true;
                    }
                }
                if (inStops == false) {
                    show = false;
                }
            }

            if (show == true) {
                filtered.push(flight);
            }

        }

        renderFlights(filtered);

    }

    $(document).on("change", ".filter-price, .filter-stops, .filter-schedule, .filter-airline", function() {
        applyFilters();
    });

    // View Details Modal
    $("#flightResults").on("click", ".viewDetailsBtn", function() {

        var id = $(this).data("id");
        var flight;

        for (var i = 0; i < flights.length; i++) {
            if (flights[i].id == id) {
                flight = flights[i];
            }
        }

        var details = "<p><b> Airline: </b>" + flight.airline + "</p>" +
            "<p><b> Flight Number: </b>" + flight.flightNumber + "</p>" +
            "<p><b> Origin: </b>" + flight.origin + "</p>" +
            "<p><b> Destination: </b>" + flight.destination + "</p>" +
            "<p><b> Departure: </b>" + flight.departure + "</p>" +
            "<p><b> Arrival: </b>" + flight.arrival + "</p>" +
            "<p><b> Duration: </b>" + flight.duration + "</p>" +
            "<p><b> Stops: </b>" + flight.stops + "</p>" +
            "<p><b> Price: </b> ₱" + flight.price + "</p>" +
            "<p><b> Seats Available: </b>" + flight.seats + "</p>";

        $("#modalBody").html(details);

        var modal = new bootstrap.Modal(document.getElementById("flightDetailsModal"));
        modal.show();

    });

    // Clear Filters
    $("#clearFiltersBtn, #resetFiltersBtn").click(function() {
        $(".filter-price, .filter-stops, .filter-schedule, .filter-airline").prop("checked", false);
        renderFlights(flights);
    });

});

// Render Flight Cards
function renderFlights(flightList) {

    $("#flightResults").html("");
    $("#resultsCount").text(flightList.length);

    if (flightList.length == 0) {
        $("#noResults").show();
        return;
    } else {
        $("#noResults").hide();
    }

    for (var i = 0; i < flightList.length; i++) {

        var flight = flightList[i];

        var card = "<div class='card mb-3'>" +
            "<div class='card-body'>" +
            "<div class='d-flex align-items-center mb-2'>" +
            "<i class='bi bi-airplane-fill fs-3 me-2 text-primary'></i>" +
            "<h5 class='mb-0'><span class='badge bg-primary'>" + flight.airline + "</span> " + flight.flightNumber + "</h5>" +
            "</div>" +
            "<p>" + flight.origin + " → " + flight.destination + "</p>" +
            "<p> Departure: " + flight.departure + " | Arrival: " + flight.arrival + "</p>" +
            "<p> Duration: " + flight.duration + " | Stops: " + flight.stops + "</p>" +
            "<p> Price: ₱" + flight.price + " | Seats: " + flight.seats + "</p>" +
            "<button class='btn btn-primary viewDetailsBtn' data-id='" + flight.id + "'> View Details </button>" +
            "<a href='booking.html' class='btn btn-outline-primary'> Book </a>" +
            "</div>" +
            "</div>";

        $("#flightResults").append(card);

    }

}
