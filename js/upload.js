import { STATE } from './state.js';

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const progressContainer = document.getElementById('progress-container');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const uploadStatusText = document.getElementById('upload-status-text');
  const uploadPercentage = document.getElementById('upload-percentage');
  const toastWrapper = document.getElementById('toast-wrapper');

  // Drag over / Drag enter classes
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });

  // Drag leave / drop classes
  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });

  // Handle drop
  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  // Handle file select click input
  fileInput.addEventListener('change', (e) => {
    if (fileInput.files.length > 0) {
      handleFileUpload(fileInput.files[0]);
    }
  });

  async function handleFileUpload(file) {
    const validExtensions = ['.xlsx'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      showToast('Invalid file format. Please upload an Excel (.xlsx) spreadsheet.', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('File size exceeds the 10MB limit. Please upload a smaller workbook.', 'error');
      return;
    }

    toastWrapper.innerHTML = '';
    progressContainer.style.display = 'block';
    progressBarFill.style.width = '0%';
    uploadPercentage.textContent = '0%';
    uploadStatusText.textContent = 'Reading spreadsheet columns...';

    try {
      progressBarFill.style.width = '30%';
      uploadPercentage.textContent = '30%';
      uploadStatusText.textContent = 'Processing and aligning sheet headers...';
      
      // Parse, extract, and auto-align rows to backend format
      const { rebuiltBase64, previewData } = await parseAndRealignExcelFile(file);
      
      progressBarFill.style.width = '75%';
      uploadPercentage.textContent = '75%';
      uploadStatusText.textContent = 'Saving healed workbook to workspace...';
      
      STATE.clearSession(); 
      STATE.isUploaded = true;
      STATE.fileName = file.name;
      
      try {
        sessionStorage.setItem('northstar_file_base64', rebuiltBase64);
      } catch (err) {
        console.warn('Storage limit: Failed to store file base64 in sessionStorage', err);
      }
      
      STATE.dashboardData = previewData;
      STATE.saveToSession();

      progressBarFill.style.width = '100%';
      uploadPercentage.textContent = '100%';
      uploadStatusText.textContent = 'Data healed & synced successfully!';

      showToast(`Successfully aligned and imported workbook from ${file.name}!`, 'success');
      
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1200);

    } catch (err) {
      progressContainer.style.display = 'none';
      showToast(`Excel parsing failed: ${err.message}`, 'error');
      console.error(err);
    }
  }

  function parseAndRealignExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          const XLSX = window.XLSX;
          if (!XLSX) {
            throw new Error('SheetJS library is not loaded. Cannot parse Excel file.');
          }
          const workbook = XLSX.read(data, {type: 'array'});
          
          const sheetNames = workbook.SheetNames;
          const findSheet = (keywords) => {
            return sheetNames.find(name => 
              keywords.some(kw => name.toLowerCase().replace(/\s+/g, '').includes(kw.toLowerCase()))
            );
          };

          const salesSheetName = findSheet(['salesdata', 'sales']);
          const productSheetName = findSheet(['productdata', 'product']);
          const expensesSheetName = findSheet(['expenses', 'expense']);
          const inventorySheetName = findSheet(['inventory', 'stock']);

          if (!salesSheetName || !productSheetName || !expensesSheetName || !inventorySheetName) {
            throw new Error('Missing required sheets. Make sure your workbook contains sheets for Sales Data, Product Data, Expenses, and Inventory.');
          }

          const parseSheet = (sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            return XLSX.utils.sheet_to_json(sheet, {header: 1});
          };

          const salesRaw = parseSheet(salesSheetName);
          const productRaw = parseSheet(productSheetName);
          const expensesRaw = parseSheet(expensesSheetName);
          const inventoryRaw = parseSheet(inventorySheetName);

          // Robust header finder requiring at least 4 active column cells
          const findHeaderRowIndex = (rows, keywords) => {
            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              if (row && row.filter(c => c !== null && String(c).trim() !== '').length >= 4) {
                const matched = keywords.every(kw => 
                  row.some(cell => cell !== null && cell !== undefined && String(cell).toLowerCase().includes(kw))
                );
                if (matched) return i;
              }
            }
            return -1;
          };

          const salesHeaderIdx = findHeaderRowIndex(salesRaw, ['date', 'revenue', 'orders']);
          const productHeaderIdx = findHeaderRowIndex(productRaw, ['date', 'product name', 'units sold']);
          const expensesHeaderIdx = findHeaderRowIndex(expensesRaw, ['month', 'rent', 'salaries']);
          const inventoryHeaderIdx = findHeaderRowIndex(inventoryRaw, ['product', 'stock', 'reorder']);

          if (salesHeaderIdx === -1 || productHeaderIdx === -1 || expensesHeaderIdx === -1 || inventoryHeaderIdx === -1) {
            throw new Error('Columns mismatch. Please ensure all required columns (e.g. Date, Revenue, Orders) match the template sheets.');
          }

          // Conflict-free column mapper
          const mapColumns = (headerRow) => {
            const mapping = {};
            headerRow.forEach((cell, idx) => {
              if (cell === null || cell === undefined) return;
              const val = String(cell).toLowerCase().replace(/\s+/g, '');
              
              if (val.includes('date') || val.includes('month')) {
                mapping.date = idx;
              }
              else if (val.includes('totalrevenue') || (val.includes('revenue') && !val.includes('product'))) {
                mapping.revenue = idx;
              }
              else if (val.includes('walk-in') || val.includes('walkin')) {
                mapping.walkIn = idx;
              }
              else if (val.includes('online')) {
                mapping.online = idx;
              }
              else if (val.includes('totalorders') || (val.includes('order') && !val.includes('online') && !val.includes('reorder'))) {
                mapping.orders = idx;
              }
              else if (val.includes('discount')) {
                mapping.discount = idx;
              }
              else if (val.includes('productname') || val.includes('itemname') || val.includes('sku') || val.includes('product/ingredient')) {
                mapping.sku = idx;
              }
              else if ((val.includes('unitssold') || val.includes('units')) && !val.includes('stock') && !val.includes('reorder')) {
                mapping.units = idx;
              }
              else if (val.includes('rent') && !val.includes('current')) {
                mapping.rent = idx;
              }
              else if (val.includes('salaries') || val.includes('wages')) mapping.salaries = idx;
              else if (val.includes('utilities')) mapping.utilities = idx;
              else if (val.includes('inventorypurchase') || val.includes('rawmaterial') || val.includes('rawmaterials')) mapping.inventoryPurchase = idx;
              else if (val.includes('marketing')) mapping.marketing = idx;
              else if (val.includes('logistics') || val.includes('delivery')) mapping.logistics = idx;
              else if (val.includes('loan') || val.includes('emi')) mapping.loanEmi = idx;
              else if (val.includes('other')) mapping.other = idx;
              else if (val.includes('currentstock') || val.includes('stock(units)')) mapping.currentStock = idx;
              else if (val.includes('reorderlevel') || val.includes('reorder(units)')) mapping.reorderLevel = idx;
              else if (val.includes('leadtime') || val.includes('leadtime(days)')) mapping.leadTime = idx;
              else if (val.includes('supplier')) mapping.supplier = idx;
            });
            return mapping;
          };

          const salesCols = mapColumns(salesRaw[salesHeaderIdx]);
          const productCols = mapColumns(productRaw[productHeaderIdx]);
          const expensesCols = mapColumns(expensesRaw[expensesHeaderIdx]);
          const inventoryCols = mapColumns(inventoryRaw[inventoryHeaderIdx]);

          const parseNum = (val) => {
            if (val === null || val === undefined || String(val).toUpperCase() === 'NA' || String(val).trim() === '') return 0;
            return Number(String(val).replace(/[^\d.-]/g, '')) || 0;
          };

          const isDateString = (val) => {
            if (!val) return false;
            const s = String(val).toLowerCase();
            return !s.includes('example') && !s.includes('instruction') && !s.includes('enter') && !s.includes('how to') && !s.includes('reference') && !s.includes('requirement');
          };

          // 1. Extract Sales Data
          const salesData = [];
          for (let i = salesHeaderIdx + 1; i < salesRaw.length; i++) {
            const row = salesRaw[i];
            if (!row || row.length === 0) continue;
            const dateVal = row[salesCols.date];
            const revVal = row[salesCols.revenue];
            if (dateVal && isDateString(dateVal) && revVal !== null && revVal !== undefined && String(revVal).trim() !== '') {
              salesData.push({
                date: String(dateVal).split(' ')[0],
                revenue: parseNum(row[salesCols.revenue]),
                orders: parseNum(row[salesCols.orders]),
                walkIn: parseNum(row[salesCols.walkIn]),
                online: parseNum(row[salesCols.online]),
                discount: parseNum(row[salesCols.discount])
              });
            }
          }

          // 2. Extract Product Data
          const productData = [];
          for (let i = productHeaderIdx + 1; i < productRaw.length; i++) {
            const row = productRaw[i];
            if (!row || row.length === 0) continue;
            const dateVal = row[productCols.date];
            const unitsVal = row[productCols.units];
            if (dateVal && isDateString(dateVal) && unitsVal !== null && unitsVal !== undefined && String(unitsVal).trim() !== '') {
              productData.push({
                date: String(dateVal).split(' ')[0],
                name: String(row[productCols.sku]).trim(),
                units: parseNum(row[productCols.units]),
                revenue: parseNum(row[productCols.revenue])
              });
            }
          }

          // 3. Extract Expenses Data
          const expensesData = [];
          for (let i = expensesHeaderIdx + 1; i < expensesRaw.length; i++) {
            const row = expensesRaw[i];
            if (!row || row.length === 0) continue;
            const dateVal = row[expensesCols.date];
            const rentVal = row[expensesCols.rent];
            if (dateVal && isDateString(dateVal) && rentVal !== null && rentVal !== undefined && String(rentVal).trim() !== '') {
              // Convert text month formats like "Jun 2026" to "2026-06-01" to prevent backend date parsing errors
              let dateStr = String(dateVal).trim();
              if (dateStr.match(/^[A-Za-z]{3}\s\d{4}$/)) {
                const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
                const parts = dateStr.toLowerCase().split(' ');
                dateStr = `${parts[1]}-${months[parts[0]]}-01`;
              }
              expensesData.push({
                month: dateStr,
                rent: parseNum(row[expensesCols.rent]),
                salaries: parseNum(row[expensesCols.salaries]),
                utilities: parseNum(row[expensesCols.utilities]),
                inventoryPurchase: parseNum(row[expensesCols.inventoryPurchase]),
                marketing: parseNum(row[expensesCols.marketing]),
                logistics: parseNum(row[expensesCols.logistics]),
                loanEmi: parseNum(row[expensesCols.loanEmi]),
                other: parseNum(row[expensesCols.other])
              });
            }
          }

          // 4. Extract Inventory Data
          const inventoryData = [];
          for (let i = inventoryHeaderIdx + 1; i < inventoryRaw.length; i++) {
            const row = inventoryRaw[i];
            if (!row || row.length === 0) continue;
            const skuVal = row[inventoryCols.sku];
            if (skuVal && isDateString(skuVal)) {
              inventoryData.push({
                sku: String(skuVal).trim(),
                currentStock: parseNum(row[inventoryCols.currentStock]),
                reorderLevel: parseNum(row[inventoryCols.reorderLevel]),
                leadTime: parseNum(row[inventoryCols.leadTime]),
                supplier: row[inventoryCols.supplier] ? String(row[inventoryCols.supplier]).trim() : 'N/A'
              });
            }
          }

          // Compute summaries
          const totalRevenue = salesData.reduce((sum, d) => sum + d.revenue, 0);
          const totalOrders = salesData.reduce((sum, d) => sum + d.orders, 0);
          const totalDiscounts = salesData.reduce((sum, d) => sum + d.discount, 0);

          // Group products
          const productStats = {};
          productData.forEach(p => {
            if (!productStats[p.name]) {
              productStats[p.name] = { name: p.name, units: 0, revenue: 0 };
            }
            productStats[p.name].units += p.units;
            productStats[p.name].revenue += p.revenue;
          });
          const productPerformance = Object.values(productStats).sort((a, b) => b.revenue - a.revenue);
          const topProduct = productPerformance[0] ? productPerformance[0].name : 'N/A';

          // Last month expenses total
          const lastExpenseRow = expensesData[expensesData.length - 1] || {
            rent: 0, salaries: 0, utilities: 0, inventoryPurchase: 0, marketing: 0, logistics: 0, loanEmi: 0, other: 0
          };
          const totalExpenses = lastExpenseRow.rent + lastExpenseRow.salaries + lastExpenseRow.utilities +
                                lastExpenseRow.inventoryPurchase + lastExpenseRow.marketing + lastExpenseRow.logistics +
                                lastExpenseRow.loanEmi + lastExpenseRow.other;

          // Inventory Alerts count
          let inventoryAlerts = 0;
          inventoryData.forEach(item => {
            if (item.currentStock < item.reorderLevel) {
              inventoryAlerts++;
            }
          });
          const inventoryHealth = inventoryData.length > 0 ? ((inventoryData.length - inventoryAlerts) / inventoryData.length) * 100 : 100;

          const dailySales = salesData.map(d => ({
            date: d.date.split('/').slice(0, 2).join('/'),
            revenue: d.revenue,
            orders: d.orders
          })).slice(-15);

          const previewData = {
            raw_revenue: totalRevenue,
            raw_expenses: totalExpenses,
            raw_orders: totalOrders,
            top_product: topProduct,
            is_inventory_uploaded: true,
            inventory_alerts: inventoryAlerts,
            inventory_health: inventoryHealth,
            daily_sales: dailySales,
            product_performance: productPerformance.slice(0, 10),
            expenses_breakdown: lastExpenseRow,
            inventory_status: inventoryData,
            insights: [
              { type: 'success', title: 'Workbook Synced', desc: `Successfully imported ${salesData.length} sales logs, ${productPerformance.length} products, and ${inventoryData.length} inventory items.` },
              { type: inventoryAlerts > 0 ? 'warning' : 'success', title: 'Inventory Snapshot', desc: inventoryAlerts > 0 ? `${inventoryAlerts} products have current stock levels below their reorder points.` : 'All items are fully stocked.' }
            ]
          };

          // --- REBUILD WORKBOOK WITH PERFECT ALIGNMENT FOR BACKEND API ---
          const rebuiltWorkbook = XLSX.utils.book_new();

          // 1. Sales Data (Headers on Row 9, Data starts on Row 14)
          const salesRows = [];
          for (let i = 0; i < 8; i++) salesRows.push([]);
          salesRows.push([
            '', 'Date (DD/MM/YYYY)', 'Total Revenue (₹)', 'Total Orders (#)', 'Walk-In Customers', 'Online Orders', 'Discounts Given (₹)'
          ]);
          for (let i = 0; i < 4; i++) salesRows.push([]);
          salesData.forEach(d => {
            salesRows.push(['', d.date, d.revenue, d.orders, d.walkIn, d.online, d.discount]);
          });
          const salesWS = XLSX.utils.aoa_to_sheet(salesRows);
          XLSX.utils.book_append_sheet(rebuiltWorkbook, salesWS, 'Sales Data');

          // 2. Product Data (Headers on Row 9, Data starts on Row 14)
          const productRows = [];
          for (let i = 0; i < 8; i++) productRows.push([]);
          productRows.push([
            '', 'Date (DD/MM/YYYY)', 'Product Name (exact & consistent)', 'Units Sold (#)', 'Revenue (₹)'
          ]);
          for (let i = 0; i < 4; i++) productRows.push([]);
          productData.forEach(p => {
            productRows.push(['', p.date, p.name, p.units, p.revenue]);
          });
          const productWS = XLSX.utils.aoa_to_sheet(productRows);
          XLSX.utils.book_append_sheet(rebuiltWorkbook, productWS, 'Product Data');

          // 3. Expenses Data (Headers on Row 10, Data starts on Row 15)
          const expensesRows = [];
          for (let i = 0; i < 9; i++) expensesRows.push([]);
          expensesRows.push([
            '', 'Month & Year', 'Rent (₹)', 'Salaries (₹)', 'Utilities (₹)', 'Inventory Purchase (₹)', 'Marketing (₹)', 'Logistics (₹)', 'Loan EMI (₹)', 'Other (₹)'
          ]);
          for (let i = 0; i < 4; i++) expensesRows.push([]);
          expensesData.forEach(e => {
            expensesRows.push(['', e.month, e.rent, e.salaries, e.utilities, e.inventoryPurchase, e.marketing, e.logistics, e.loanEmi, e.other]);
          });
          const expensesWS = XLSX.utils.aoa_to_sheet(expensesRows);
          XLSX.utils.book_append_sheet(rebuiltWorkbook, expensesWS, 'Expenses');

          // 4. Inventory Data (Headers on Row 10, Data starts on Row 18)
          const inventoryRows = [];
          for (let i = 0; i < 9; i++) inventoryRows.push([]);
          inventoryRows.push([
            '', 'Product / Ingredient / SKU', 'Current Stock (units)', 'Reorder Level (units)', 'Lead Time (days)', 'Supplier Name (optional)'
          ]);
          for (let i = 0; i < 7; i++) inventoryRows.push([]);
          inventoryData.forEach(inv => {
            inventoryRows.push(['', inv.sku, inv.currentStock, inv.reorderLevel, inv.leadTime, inv.supplier]);
          });
          const inventoryWS = XLSX.utils.aoa_to_sheet(inventoryRows);
          XLSX.utils.book_append_sheet(rebuiltWorkbook, inventoryWS, 'Inventory');

          // Convert rebuilt workbook to base64
          const wbout = XLSX.write(rebuiltWorkbook, { bookType: 'xlsx', type: 'array' });
          const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const base64Reader = new FileReader();
          
          base64Reader.onload = function(e) {
            resolve({
              rebuiltBase64: e.target.result,
              previewData: previewData
            });
          };
          base64Reader.readAsDataURL(blob);

        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read Excel workbook file.'));
      reader.readAsArrayBuffer(file);
    });
  }

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;
    
    const iconName = type === 'success' ? 'check-circle' : 'alert-circle';
    toast.innerHTML = `
      <i class="lucide-${iconName}" style="width: 20px; height: 20px; flex-shrink:0;"></i>
      <span>${message}</span>
    `;
    
    toastWrapper.appendChild(toast);
    
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
});
