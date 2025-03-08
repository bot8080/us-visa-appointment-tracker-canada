// Default location mappings
const defaultLocationMappings = {
    '94': 'Toronto',
    '92': 'Ottawa'
  };
  
  // Utility functions for date formatting
  function formatDate(dateString) {
    try {
      // Create date with timezone handling to avoid off-by-one errors
      const date = createDateWithTimezone(dateString);
      
      if (isNaN(date.getTime())) {
        console.error(`Invalid date: ${dateString}`);
        return dateString; // Return original string if invalid
      }
      
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
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
      
      // Set both dates to start of day for accurate comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Use a consistent time (noon) to avoid timezone issues
      date.setHours(12, 0, 0, 0);
      today.setHours(12, 0, 0, 0);
      
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
  
  
  // Function to update the status UI with request information
  function updateRequestStatus(message, isError = false) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.style.color = isError ? '#f44336' : '#666';
    
    // Also add to the request log if it exists
    const requestLog = document.getElementById('request-log');
    if (requestLog) {
      const logEntry = document.createElement('div');
      logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
      logEntry.style.color = isError ? '#f44336' : '#666';
      logEntry.style.borderBottom = '1px solid #eee';
      logEntry.style.padding = '4px 0';
      requestLog.prepend(logEntry);
      
      // Limit log entries to 10
      if (requestLog.children.length > 10) {
        requestLog.removeChild(requestLog.lastChild);
      }
    }
  }
  
  document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup opened and DOM loaded');
  
    // Set up tab navigation
    const appointmentsTab = document.getElementById('tab-appointments');
    const settingsTab = document.getElementById('tab-settings');
    const appointmentsContent = document.getElementById('appointments-tab');
    const settingsContent = document.getElementById('settings-tab');
    
    appointmentsTab.addEventListener('click', function() {
      appointmentsTab.classList.add('active');
      settingsTab.classList.remove('active');
      appointmentsContent.classList.add('active-tab');
      settingsContent.classList.remove('active-tab');
    });
    
    settingsTab.addEventListener('click', function() {
      settingsTab.classList.add('active');
      appointmentsTab.classList.remove('active');
      settingsContent.classList.add('active-tab');
      appointmentsContent.classList.remove('active-tab');
      loadLocationSettings();
    });
    
    // Initialize location mappings if not already set
    chrome.storage.local.get(['locationMappings'], function(result) {
      console.log('Retrieved location mappings from storage:', result);
      if (!result.locationMappings) {
        console.log('No location mappings found, initializing with defaults');
        chrome.storage.local.set({locationMappings: defaultLocationMappings});
      }
    });
    
    // Add status information area
    const statusContainer = document.createElement('div');
    statusContainer.id = 'connection-status';
    statusContainer.style.padding = '10px';
    statusContainer.style.marginTop = '10px';
    statusContainer.style.backgroundColor = '#f8f8f8';
    statusContainer.style.borderRadius = '4px';
    statusContainer.style.fontSize = '12px';
    
    document.getElementById('appointments-tab').appendChild(statusContainer);
    
    // Check connection status
    checkConnectionStatus();
    
    // Add extraction button
    const extractButton = document.createElement('button');
    extractButton.textContent = 'Extract Data from Current Page';
    extractButton.style.backgroundColor = '#4285f4';
    extractButton.style.color = 'white';
    extractButton.style.marginTop = '10px';
    extractButton.addEventListener('click', function() {
      updateRequestStatus('Extracting page data...');
      
      // Send message to background script to extract page info
      chrome.runtime.sendMessage({
        action: "extractPageInfo"
      }, function(response) {
        console.log('Extract page info response:', response);
        if (response && response.success) {
          updateRequestStatus('Page data extracted successfully!');
          checkConnectionStatus();
        } else {
          updateRequestStatus('Failed to extract page data. Make sure you are on the visa website.', true);
        }
      });
    });
    
    document.getElementById('appointments-tab').insertBefore(extractButton, statusContainer);
    
    // Add clear all data button
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear All Data';
    clearButton.style.backgroundColor = '#f44336';
    clearButton.style.color = 'white';
    clearButton.style.marginTop = '10px';
    clearButton.style.marginLeft = '10px';
    clearButton.addEventListener('click', function() {
      if (confirm('Are you sure you want to clear all appointment data?')) {
        updateRequestStatus('Clearing data...');
        
        // Send message to background script to clear all data
        chrome.runtime.sendMessage({
          action: "clearAllData"
        }, function(response) {
          console.log('Clear data response:', response);
          if (response && response.success) {
            updateRequestStatus('All data cleared!');
            // Refresh the table to show empty state
            chrome.runtime.sendMessage({action: "getAppointmentData"}, function(response) {
              updatePopupTable(response.data || { locations: [] });
            });
          } else {
            updateRequestStatus('Failed to clear data', true);
          }
        });
      }
    });
    
    document.getElementById('appointments-tab').insertBefore(clearButton, statusContainer);
    
    // Add a request log section
    const requestLogContainer = document.createElement('div');
    requestLogContainer.id = 'request-log-container';
    requestLogContainer.style.marginTop = '15px';
    requestLogContainer.style.borderTop = '1px solid #ddd';
    requestLogContainer.style.paddingTop = '10px';
    
    const requestLogTitle = document.createElement('h4');
    requestLogTitle.textContent = 'Request Log';
    requestLogTitle.style.margin = '0 0 8px 0';
    requestLogContainer.appendChild(requestLogTitle);
    
    const requestLog = document.createElement('div');
    requestLog.id = 'request-log';
    requestLog.style.fontSize = '11px';
    requestLog.style.maxHeight = '150px';
    requestLog.style.overflowY = 'auto';
    requestLogContainer.appendChild(requestLog);
    
    document.getElementById('appointments-tab').appendChild(requestLogContainer);
    
    // Request appointment data when popup opens
    console.log('Requesting appointment data from background');
    chrome.runtime.sendMessage({action: "getAppointmentData"}, function(response) {
      console.log('Got appointment data response:', response);
      if (response && response.data) {
        updatePopupTable(response.data);
      } else {
        console.log('No appointment data received or data is empty');
        updateRequestStatus('No data available yet. Please log in to usvisa-info.com first.');
      }
    });
    
    // Set up refresh button
    document.getElementById('refresh-button').addEventListener('click', function() {
      updateRequestStatus('Sending refresh request to background script...');
      
      // Disable button during refresh
      const refreshButton = document.getElementById('refresh-button');
      const originalText = refreshButton.textContent;
      refreshButton.textContent = '⟳ Refreshing...';
      refreshButton.disabled = true;
      
      // Request fresh data
      chrome.runtime.sendMessage({action: "forceDataFetch"}, function(response) {
        console.log('Refresh data response:', response);
        if (response && response.success) {
          updateRequestStatus('Refresh request sent successfully. Waiting for data...');
        } else {
          updateRequestStatus('Refresh request failed', true);
          
          // Restore button state
          refreshButton.textContent = originalText;
          refreshButton.disabled = false;
        }
      });
    });
    
    // Set up toggle table button
    document.getElementById('toggle-table-button').addEventListener('click', function() {
      // Get the active tab
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          // Send message to content script to toggle table
          chrome.tabs.sendMessage(tabs[0].id, {action: "toggleTable"});
        }
      });
    });
    
    // Set up add location button
    document.getElementById('add-location-button').addEventListener('click', function() {
      const locationName = document.getElementById('location-name').value.trim();
      const locationId = document.getElementById('location-id').value.trim();
      
      if (!locationName || !locationId) {
        updateRequestStatus('Please enter both name and ID', true);
        return;
      }
      
      // Get current location mappings
      chrome.storage.local.get(['locationMappings'], function(result) {
        const locationMappings = result.locationMappings || {};
        
        // Add new location
        locationMappings[locationId] = locationName;
        
        // Save updated mappings
        chrome.storage.local.set({locationMappings: locationMappings}, function() {
          updateRequestStatus(`Added location: ${locationName}`);
          
          // Clear input fields
          document.getElementById('location-name').value = '';
          document.getElementById('location-id').value = '';
          
          // Reload locations table
          loadLocationSettings();
          
          // Send message to background script to update location mappings
          chrome.runtime.sendMessage({
            action: "updateLocationMappings",
            data: locationMappings
          });
          
          // Directly fetch data for the new location
          chrome.runtime.sendMessage({
            action: "checkAppointmentsForLocation",
            locationId: locationId
          });
        });
      });
    });
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      console.log('Popup received message:', request);
      
      if (request.action === "fetchStarted") {
        updateRequestStatus(`Fetching data for ${request.locationName || request.locationId}...`);
      }
      else if (request.action === "fetchCompleted") {
        updateRequestStatus(`Successfully fetched data for ${request.locationName || request.locationId}`);
        
        // KEY FIX: Update the table with the data passed in the message
        if (request.data) {
          updatePopupTable(request.data);
        } else {
          // Fallback to fetching from background if data not included
          chrome.runtime.sendMessage({action: "getAppointmentData"}, function(response) {
            if (response && response.data) {
              updatePopupTable(response.data);
            }
          });
        }
        
        // Re-enable the refresh button if it was disabled
        const refreshButton = document.getElementById('refresh-button');
        if (refreshButton && refreshButton.disabled) {
          refreshButton.textContent = 'Refresh Data';
          refreshButton.disabled = false;
        }
      }
      else if (request.action === "fetchError") {
        updateRequestStatus(`Error fetching data: ${request.error}`, true);
        
        // Re-enable the refresh button if it was disabled
        const refreshButton = document.getElementById('refresh-button');
        if (refreshButton && refreshButton.disabled) {
          refreshButton.textContent = 'Refresh Data';
          refreshButton.disabled = false;
        }
      }
      else if (request.action === "fetchInfo") {
        updateRequestStatus(request.message);
      }
      else if (request.action === "permissionDenied") {
        updateRequestStatus(`Permission error: ${request.message}`, true);
      }
    });
  
    // Check for cookie permission status
    chrome.storage.local.get(['cookiePermissionGranted'], function(result) {
      if (result.cookiePermissionGranted === false) {
        updateRequestStatus("Cookie permission denied. The extension requires cookie access to work correctly.", true);
      }
    });
  });
  
  // Update the popup table with appointment data
  function updatePopupTable(data) {
    console.log('Updating popup table with data:', data);
    const tbody = document.getElementById('popup-table-body');
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Remove any existing timestamp
    const existingTimestamp = document.querySelector('#latest-data > div:last-child');
    if (existingTimestamp && existingTimestamp.textContent.includes('Last updated')) {
      existingTimestamp.remove();
    }
    
    // Check if data is available
    if (!data || !data.locations || data.locations.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 2;
      cell.textContent = 'No appointment data available';
      cell.className = 'no-data';
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }
    
    // Log data for debugging
    console.log('Data for popup table:', data);
    console.log('Locations array:', data.locations);
    
    // Sort locations alphabetically
    const sortedLocations = [...data.locations].sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
    
    console.log('Sorted locations:', sortedLocations);
    
    // Add a row for each location
    sortedLocations.forEach(location => {
      console.log(`Processing location ${location.name}, dates:`, location.availableDates);
      
      const row = document.createElement('tr');
      
      // Location cell
      const locationCell = document.createElement('td');
      locationCell.textContent = location.name;
      locationCell.className = 'location-name';
      row.appendChild(locationCell);
      
      // Next available date cell
      const nextDateCell = document.createElement('td');
      if (location.availableDates && location.availableDates.length > 0) {
        // Sort dates and get the earliest one
        const sortedDates = [...location.availableDates].sort();
        console.log(`Sorted dates for ${location.name}:`, sortedDates);
        
        const earliestDate = sortedDates[0];
        const daysFromNow = getDaysFromNow(earliestDate);
        
        nextDateCell.textContent = `${formatDate(earliestDate)} (${daysFromNow} days)`;
        
        // Add color indicator based on how soon the appointment is
        if (daysFromNow <= 30) {
          nextDateCell.style.color = '#008800'; // Green for soon
          nextDateCell.style.fontWeight = 'bold';
        } else if (daysFromNow <= 90) {
          nextDateCell.style.color = '#885500'; // Orange for medium
        } else {
          nextDateCell.style.color = '#000000'; // Black for far away
        }
      } else {
        nextDateCell.textContent = 'No availability';
        nextDateCell.style.color = '#888888';
        nextDateCell.style.fontStyle = 'italic';
      }
      row.appendChild(nextDateCell);
      
      tbody.appendChild(row);
    });
    
    // Add last updated timestamp
    const lastUpdated = document.createElement('div');
    lastUpdated.style.fontSize = '11px';
    lastUpdated.style.color = '#666';
    lastUpdated.style.marginTop = '10px';
    lastUpdated.textContent = `Last checked: ${new Date().toLocaleString()}`;
    document.getElementById('latest-data').appendChild(lastUpdated);
  }
  
  // Check connection status and schedule ID
  function checkConnectionStatus() {
    const statusContainer = document.getElementById('connection-status');
    
    // Clear existing content
    statusContainer.innerHTML = '';
    
    // Get schedule ID
    chrome.storage.local.get(['scheduleId'], function(result) {
      const scheduleIdStatus = document.createElement('div');
      
      if (result.scheduleId) {
        scheduleIdStatus.innerHTML = `✅ Schedule ID: <strong>${result.scheduleId}</strong>`;
        scheduleIdStatus.style.color = 'green';
      } else {
        scheduleIdStatus.innerHTML = '❌ <strong>No Schedule ID found</strong>. Please visit usvisa-info.com and log in.';
        scheduleIdStatus.style.color = 'red';
      }
      
      statusContainer.appendChild(scheduleIdStatus);
      
      // Check if we're on the visa info site
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const siteStatus = document.createElement('div');
        siteStatus.style.marginTop = '5px';
        
        if (tabs[0] && tabs[0].url && tabs[0].url.includes('usvisa-info.com')) {
          siteStatus.innerHTML = '✅ <strong>Connected to usvisa-info.com</strong>';
          siteStatus.style.color = 'green';
        } else {
          siteStatus.innerHTML = '❓ <strong>Not on usvisa-info.com</strong>. For best results, open the site first.';
          siteStatus.style.color = 'orange';
        }
        
        statusContainer.appendChild(siteStatus);
        
        // Check appointment data
        chrome.storage.local.get(['appointmentData'], function(result) {
          const dataStatus = document.createElement('div');
          dataStatus.style.marginTop = '5px';
          
          if (result.appointmentData && Object.keys(result.appointmentData).length > 0) {
            const lastUpdated = new Date(Object.values(result.appointmentData)[0].lastUpdated || 0);
            const isValidDate = !isNaN(lastUpdated.getTime());
            
            dataStatus.innerHTML = `✅ <strong>Appointment data available</strong>${isValidDate ? ' (Last updated: ' + lastUpdated.toLocaleString() + ')' : ''}`;
            dataStatus.style.color = 'green';
          } else {
            dataStatus.innerHTML = '❌ <strong>No appointment data</strong>. Click "Extract Data" then "Refresh Data"';
            dataStatus.style.color = 'red';
          }
          
          statusContainer.appendChild(dataStatus);
        });
        
        // Instructions
        const instructions = document.createElement('div');
        instructions.style.marginTop = '10px';
        instructions.style.fontSize = '11px';
        instructions.innerHTML = '<strong>How to use:</strong><br>1. Log in to usvisa-info.com<br>2. Click "Extract Data from Current Page"<br>3. Click "Refresh Data" to check appointments';
        
        statusContainer.appendChild(instructions);
      });
    });
  }
  
  // Load location settings into the settings tab
  function loadLocationSettings() {
    const locationsTableBody = document.getElementById('locations-table-body');
    
    // Clear existing rows
    locationsTableBody.innerHTML = '';
    
    // Get current location mappings
    chrome.storage.local.get(['locationMappings'], function(result) {
      const locationMappings = result.locationMappings || {};
      
      // Check if there are any locations
      if (Object.keys(locationMappings).length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 3;
        cell.textContent = 'No locations configured';
        cell.style.textAlign = 'center';
        cell.style.padding = '10px';
        cell.style.color = '#888';
        row.appendChild(cell);
        locationsTableBody.appendChild(row);
        return;
      }
      
      // Add a row for each location
      Object.entries(locationMappings).forEach(([id, name]) => {
        const row = document.createElement('tr');
        
        // Location name cell
        const nameCell = document.createElement('td');
        nameCell.textContent = name;
        row.appendChild(nameCell);
        
        // Location ID cell
        const idCell = document.createElement('td');
        idCell.textContent = id;
        row.appendChild(idCell);
        
        // Action cell (delete button)
        const actionCell = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Remove';
        deleteButton.style.padding = '2px 5px';
        deleteButton.style.fontSize = '11px';
        deleteButton.addEventListener('click', function() {
          // Remove location
          delete locationMappings[id];
          
          // Save updated mappings
          chrome.storage.local.set({locationMappings: locationMappings}, function() {
            // Reload locations table
            loadLocationSettings();
            
            // Send message to background script to update location mappings
            chrome.runtime.sendMessage({
              action: "updateLocationMappings",
              data: locationMappings
            });
          });
        });
        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);
        
        locationsTableBody.appendChild(row);
      });
    });
  }