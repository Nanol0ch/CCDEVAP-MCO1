$(document).ready(function() {

    // Trip Type Toggle
    $("#oneWayBtn").click(function() {
        $("#returnDateSection").hide();
    });

    $("#roundTripBtn").click(function() {
        $("#returnDateSection").show();
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

        if (valid == true) {
            $("#resultsSection").show();
            renderFlights(flights);
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

    $(".filter-price, .filter-stops, .filter-schedule").change(function() {
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
        $(".filter-price, .filter-stops, .filter-schedule").prop("checked", false);
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
            "<h5><span class='badge bg-primary'>" + flight.airline + "</span> " + flight.flightNumber + "</h5>" +
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
