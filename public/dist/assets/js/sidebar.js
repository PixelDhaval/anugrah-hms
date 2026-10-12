

fetch(`/get-permissions`)
    .then((response) => response.json)
    .then((data) => {
        if (data.appointment == false) {
            document.getElementById("appointment").style.display = "none";
        }
        if (data.patient == false) {
            document.getElementById("patient").style.display = "none";
        }
        if (data.docter == false) {
            document.getElementById("doctors").style.display = "none";
        }
        if (data.user_management == false) {
            document.getElementById("users").style.display = "none";
        }
        if (data.billing == false) {
            document.getElementById("billing").style.display = "none";
        }
        if (data.reports == false) {
            document.getElementById("reports").style.display = "none";
        }
    });
