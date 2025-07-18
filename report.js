// report.js

document.addEventListener('DOMContentLoaded', () => {
    const reportForm = document.getElementById('report-form');
    const backButton = document.getElementById('back-button');
    const issueTypeSelect = document.getElementById('issue_type');
    const locationInput = document.getElementById('location');
    const descriptionTextarea = document.getElementById('description');
    const submitButton = document.getElementById('submit-report-button');
    const successAlert = document.getElementById('success-alert');
    const submitErrorAlert = document.getElementById('submit-error-alert');

    const issueTypes = [
        { value: "dirty_restroom", label: "Dirty restroom" },
        { value: "overflowing_bin", label: "Overflowing bin" },
        { value: "no_dispenser", label: "No dispenser" },
        { value: "no_water", label: "No water" },
        { value: "safety_concern", label: "Safety concern" },
        { value: "other", label: "Other" },
    ];

    // Populate issue types
    issueTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type.value;
        option.textContent = type.label;
        issueTypeSelect.appendChild(option);
    });

    const facilityIdInput = document.getElementById('facility_id');
    const buildingInput = document.getElementById('building');

    // Helper to get query param
    function getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    // Auto-fill facility_id from query param
    const facilityId = getQueryParam('facility_id');
    if (facilityId) {
        facilityIdInput.value = facilityId;
        // Fetch facility details from backend
        fetch(`http://localhost:3001/facility/${facilityId}`)
            .then(res => {
                if (!res.ok) throw new Error('Facility not found');
                return res.json();
            })
            .then(facility => {
                buildingInput.value = facility.building || '';
            })
            .catch(err => {
                buildingInput.value = '';
                console.error('Error fetching facility:', err);
            });
    }

    // Simple in-memory storage for reports (for demonstration)
    // In a real application, you might use localStorage, IndexedDB, or a backend API
    // let reports = [];

    // Load reports from localStorage (if available)
    // const loadReports = () => {
    //     try {
    //         const storedReports = localStorage.getItem('menstrualHygieneReports');
    //         if (storedReports) {
    //             reports = JSON.parse(storedReports);
    //         }
    //     } catch (e) {
    //         console.error("Error loading reports from localStorage", e);
    //     }
    // };

    // Save reports to localStorage
    // const saveReports = () => {
    //     try {
    //         localStorage.setItem('menstrualHygieneReports', JSON.stringify(reports));
    //     } catch (e) {
    //         console.error("Error saving reports to localStorage", e);
    //     }
    // };

    // Add a new report
    // const addReport = (reportData) => {
    //     const newReport = {
    //         id: crypto.randomUUID(),
    //         timestamp: new Date().toISOString(),
    //         ...reportData,
    //     };
    //     reports.unshift(newReport); // Add to the beginning
    //     saveReports();
    // };

    // Validation Service (simplified version of ReportValidationService)
    const ReportValidationService = {
        validateReport: (data) => {
            const errors = {};

            if (!data.issueType || data.issueType.trim() === "") {
                errors.issueType = "Please select an issue type";
            }

            if (!data.location || data.location.trim() === "") {
                errors.location = "Location is required";
            } else if (data.location.trim().length < 3) {
                errors.location = "Location must be at least 3 characters long";
            } else if (data.location.trim().length > 200) {
                errors.location = "Location must be less than 200 characters";
            }

            if (data.description && data.description.trim().length > 1000) {
                errors.description = "Description must be less than 1000 characters";
            }

            return {
                isValid: Object.keys(errors).length === 0,
                errors: errors,
            };
        },
        sanitizeInput: (input) => {
            return input
                .trim()
                .replace(/[<>]/g, "")
                .replace(/\s+/g, " ");
        }
    };

    // Helper to display errors
    const displayError = (field, message) => {
        const errorElement = document.getElementById(`${field}-error`);
        if (errorElement) {
            errorElement.querySelector('span').textContent = message;
            errorElement.style.display = 'flex';
            document.getElementById(field).classList.add('error');
        }
    };

    // Helper to clear errors
    const clearErrors = () => {
        document.querySelectorAll('.error-message').forEach(el => {
            el.style.display = 'none';
            el.querySelector('span').textContent = '';
        });
        document.querySelectorAll('.input-field, .textarea-field, .select-trigger').forEach(el => {
            el.classList.remove('error');
        });
        submitErrorAlert.style.display = 'none';
        submitErrorAlert.querySelector('p').textContent = '';
    };

    // Event Listeners for input changes to clear errors
    issueTypeSelect.addEventListener('change', () => {
        if (document.getElementById('issueType-error').style.display !== 'none') {
            displayError('issueType', ''); // Clear the error message
            document.getElementById('issueType-error').style.display = 'none';
            issueTypeSelect.classList.remove('error');
        }
    });

    locationInput.addEventListener('input', () => {
        if (document.getElementById('location-error').style.display !== 'none') {
            displayError('location', ''); // Clear the error message
            document.getElementById('location-error').style.display = 'none';
            locationInput.classList.remove('error');
        }
    });

    descriptionTextarea.addEventListener('input', () => {
        if (document.getElementById('description-error').style.display !== 'none') {
            displayError('description', ''); // Clear the error message
            document.getElementById('description-error').style.display = 'none';
            descriptionTextarea.classList.remove('error');
        }
    });


    // Form Submission
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
        successAlert.style.display = 'none';

        const formData = {
            issueType: issueTypeSelect.value,
            location: locationInput.value,
            description: descriptionTextarea.value,
        };

        const validationResult = ReportValidationService.validateReport(formData);

        if (!validationResult.isValid) {
            for (const field in validationResult.errors) {
                displayError(field, validationResult.errors[field]);
            }
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Report';
            return;
        }

        try {
            // Sanitize data before sending to backend
            const sanitizedData = {
                issueType: ReportValidationService.sanitizeInput(formData.issueType),
                location: ReportValidationService.sanitizeInput(formData.location),
                description: formData.description ? ReportValidationService.sanitizeInput(formData.description) : undefined,
            };

            // Send data to backend for priority generation
            const response = await fetch('http://localhost:3001/generate-priority', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sanitizedData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get priority from server.');
            }

            const { priority } = await response.json();
            
            // Add report with priority - now handled by server
            // addReport({ ...sanitizedData, priority });

            // Log the complete report to the browser console
            console.log("Report submitted with priority:", { ...sanitizedData, priority });

            successAlert.style.display = 'flex';
            // setTimeout(() => {
            //     successAlert.style.display = 'none';
            //     window.location.href = 'dashboard.html'; // Redirect to dashboard
            // }, 2000);

            // Reset form after successful submission
            reportForm.reset();
            issueTypeSelect.value = ""; // Explicitly reset select

        } catch (error) {
            console.error("Error submitting report or getting priority:", error);
            submitErrorAlert.querySelector('p').textContent = error.message || 'An unexpected error occurred. Please try again.';
            submitErrorAlert.style.display = 'flex';
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Report';
        }
    });

    // Back button navigation
    backButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // Initial load of reports
    // loadReports();
}); 
