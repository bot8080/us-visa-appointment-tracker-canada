// Utility functions for date formatting
function formatDate(dateString) {
    try {
      // Create date with timezone handling to avoid off-by-one errors
      const date = createDateWithTimezone(dateString);
      
      if (isNaN(date.getTime())) {
        console.error(`Invalid date: ${dateString}`);
        return 'Invalid date';
      }
      
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        weekday: 'short'
      });
    } catch (error) {
      console.error(`Error formatting date ${dateString}:`, error);
      return dateString; // Return the original string if there's an error
    }
  }
  
  
  function getDaysFromNow(dateString) {
    try {
      // Create date with timezone handling to avoid off-by-one errors
      const date = createDateWithTimezone(dateString);
      
      if (isNaN(date.getTime())) {
        console.error(`Invalid date for days calculation: ${dateString}`);
        return "?";
      }
      
      // Use a consistent time (noon) to avoid timezone issues
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      date.setHours(12, 0, 0, 0);
      
      const daysDifference = Math.floor((date - today) / (1000 * 60 * 60 * 24));
      return daysDifference;
    } catch (error) {
      console.error(`Error calculating days from ${dateString}:`, error);
      return "?";
    }
  }

  function createDateWithTimezone(dateString) {
  // Parse the date string in UTC
  const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
  
  // Create a date object with the parsed values (months in JS are 0-indexed)
  // By specifying all components, we avoid automatic timezone adjustments
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  
  return date;
}

  
  // Create and insert the appointment table
  function createAppointmentTable() {
    console.log('Creating appointment table in content script');
    
    // Check if table already exists
    if (document.getElementById('visa-appointment-tracker')) {
      console.log('Table already exists, not creating a duplicate');
      return;
    }
    
    // Create the container div
    const container = document.createElement('div');
    container.id = 'visa-appointment-tracker';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.padding = '15px';
    container.style.backgroundColor = 'white';
    container.style.border = '1px solid #ccc';
    container.style.borderRadius = '5px';
    container.style.zIndex = '9999';
    container.style.maxHeight = '80vh';
    container.style.overflowY = 'auto';
    container.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
    
    // Create the title
    const title = document.createElement('h3');
    title.textContent = 'US Visa Appointment Availability';
    title.style.margin = '0 0 15px 0';
    container.appendChild(title);
    
    // Create the table
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    
    // Add table headers
    const headerRow = document.createElement('tr');
    ['Location', 'Next Available Date', 'Additional Dates'].forEach(headerText => {
      const th = document.createElement('th');
      th.textContent = headerText;
      th.style.padding = '8px';
      th.style.borderBottom = '1px solid #ddd';
      th.style.textAlign = 'left';
      headerRow.appendChild(th);
    });
    const thead = document.createElement('thead');
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Add table body
    const tbody = document.createElement('tbody');
    tbody.id = 'appointment-data-tbody';
    table.appendChild(tbody);
    
    container.appendChild(table);
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '10px';
    closeButton.style.border = 'none';
    closeButton.style.background = 'none';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '16px';
    closeButton.addEventListener('click', function() {
      container.style.display = 'none';
    });
    container.appendChild(closeButton);
    
    // Add refresh button
    const refreshButton = document.createElement('button');
    refreshButton.textContent = 'Refresh Data';
    refreshButton.style.padding = '5px 10px';
    refreshButton.style.marginTop = '10px';
    refreshButton.addEventListener('click', function() {
      // Update status to loading
      updateStatusMessage('Requesting data...');
      
      // Request fresh data from background script
      chrome.runtime.sendMessage({action: "getAppointmentData"}, function(response) {
        if (response && response.data) {
          updateTableWithData(response.data);
        } else {
          updateStatusMessage('Failed to get data. Try using the extension popup.', true);
        }
      });
    });
    container.appendChild(refreshButton);
    
    // Add a status message area
    const statusMessage = document.createElement('div');
    statusMessage.id = 'visa-tracker-status';
    statusMessage.style.marginTop = '10px';
    statusMessage.style.fontSize = '12px';
    statusMessage.style.fontStyle = 'italic';
    statusMessage.style.color = '#666';
    container.appendChild(statusMessage);
    
    // Add to page
    document.body.appendChild(container);
    
    // Set initial status
    updateStatusMessage('Requesting appointment data...');
    
    // Request initial data
    chrome.runtime.sendMessage({action: "getAppointmentData"}, function(response) {
      console.log('Initial data response in content script:', response);
      if (response && response.data) {
        updateTableWithData(response.data);
        updateStatusMessage(`Data updated: ${new Date().toLocaleString()}`);
      } else {
        updateStatusMessage('No data available. Try using the extension popup.', true);
      }
    });
  }
  
  // Helper function to update the status message
  function updateStatusMessage(message, isError = false) {
    const statusElem = document.getElementById('visa-tracker-status');
    if (statusElem) {
      statusElem.textContent = message;
      statusElem.style.color = isError ? '#f44336' : '#666';
    }
  }
  
  // Update the table with appointment data
  function updateTableWithData(data) {
    console.log('Updating table with data:', data);
    
    const tbody = document.getElementById('appointment-data-tbody');
    if (!tbody) {
      console.error('Could not find table body element');
      return;
    }
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Check if data is available
    if (!data || !data.locations || data.locations.length === 0) {
      console.log('No data available for table');
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 3;
      cell.textContent = 'No appointment data available yet';
      cell.style.padding = '8px';
      cell.style.textAlign = 'center';
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }
    
    console.log(`Populating table with ${data.locations.length} locations`);
    
    // Add a row for each location
    data.locations.forEach(location => {
      const row = document.createElement('tr');
      
      // Location cell
      const locationCell = document.createElement('td');
      locationCell.textContent = location.name;
      locationCell.style.padding = '8px';
      locationCell.style.borderBottom = '1px solid #ddd';
      locationCell.style.fontWeight = 'bold';
      row.appendChild(locationCell);
      
      // Next available date cell
      const nextDateCell = document.createElement('td');
      
      // Debug log the available dates
      console.log(`Available dates for ${location.name}:`, location.availableDates);
      
      if (location.availableDates && location.availableDates.length > 0) {
        // Make a fresh copy to avoid modifying the original
        const datesCopy = [...location.availableDates];
        
        // Sort dates chronologically
        const sortedDates = datesCopy.sort();
        console.log(`Sorted dates for ${location.name}:`, sortedDates);
        
        // Format the earliest date
        const earliestDate = sortedDates[0];
        nextDateCell.textContent = formatDate(earliestDate);
        
        // Highlight if the date is in the next 30 days
        const daysDifference = getDaysFromNow(earliestDate);
        
        nextDateCell.textContent += ` (${daysDifference} days)`;
        
        if (daysDifference <= 30) {
          nextDateCell.style.backgroundColor = '#e6f7e6'; // Light green
          nextDateCell.style.fontWeight = 'bold';
        } else if (daysDifference <= 90) {
          nextDateCell.style.backgroundColor = '#fff9e6'; // Light yellow
        }
      } else {
        nextDateCell.textContent = 'No availability';
      }
      nextDateCell.style.padding = '8px';
      nextDateCell.style.borderBottom = '1px solid #ddd';
      row.appendChild(nextDateCell);
      
      // Additional dates cell
      const additionalDatesCell = document.createElement('td');
      if (location.availableDates && location.availableDates.length > 1) {
        // Make a fresh copy to avoid modifying the original
        const datesCopy = [...location.availableDates];
        
        // Show the next 3 dates after the earliest one
        const sortedDates = datesCopy.sort();
        const additionalDates = sortedDates.slice(1, 4);
        additionalDatesCell.textContent = additionalDates
          .map(date => formatDate(date))
          .join(', ');
      } else {
        additionalDatesCell.textContent = 'None';
      }
      additionalDatesCell.style.padding = '8px';
      additionalDatesCell.style.borderBottom = '1px solid #ddd';
      row.appendChild(additionalDatesCell);
      
      tbody.appendChild(row);
    });
    
    // Update status message
    updateStatusMessage(`Data updated: ${new Date().toLocaleString()}`);
  }
  
  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      console.log('Content script received message:', request);
      
      if (request.action === "updateAppointmentTable") {
        console.log("Received update appointment table message:", request.data);
        // Create table if it doesn't exist
        if (!document.getElementById('visa-appointment-tracker')) {
          createAppointmentTable();
        }
        // Update the table with the new data
        updateTableWithData(request.data);
      } else if (request.action === "toggleTable") {
        const table = document.getElementById('visa-appointment-tracker');
        if (table) {
          if (table.style.display === 'none') {
            table.style.display = 'block';
          } else {
            table.style.display = 'none';
          }
        } else {
          createAppointmentTable();
        }
      }
    }
  );
  
  // Initialize the table when the page loads
  console.log('Content script loaded');
  window.addEventListener('load', function() {
    console.log('Page loaded, initializing appointment table');
    // Wait a bit to ensure the page is fully loaded
    setTimeout(createAppointmentTable, 1000);
  });