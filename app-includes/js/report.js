function post(path, params, method) {
    method = method || "post"; // Set method to post by default if not specified.

    // The rest of this code assumes you are not using a library.
    // It can be made less wordy if you use one.
    var form = document.createElement("form");
    form.setAttribute("method", method);
    form.setAttribute("action", path);

    for(var key in params) {
        if(params.hasOwnProperty(key)) {
            var hiddenField = document.createElement("input");
            hiddenField.setAttribute("type", "hidden");
            hiddenField.setAttribute("name", key);
            hiddenField.setAttribute("value", params[key]);

            form.appendChild(hiddenField);
         }
    }

    document.body.appendChild(form);
    form.submit();
}

function uniq(a) {
    var seen = {};
    return a.filter(function(item) {
        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
    });
}

var Report = function(urlData, typeName, all, team, cameleon){
	this.urlData = urlData;
	this.data = [];
	this.typeName = typeName;
	this.all = all;
	this.team = team;
	this.cameleon = cameleon;
	this.pendingSpark = 0;
	this.pendingGeo = 0;

	var thisR = this;
	$(document).ready(function(){
		// Load data
		thisR.load();
	});
};

/*
	---------------
	LOAD & SAVE
	---------------
*/

Report.prototype.load = function(){
	var thisR = this;
	$.ajax({
		type: "POST",
		url: thisR.urlData,
		data: {type: 'report', request: 'load', dataType: thisR.typeName, all: Boolean(thisR.all), team: Boolean(thisR.team), cameleon: thisR.cameleon},
		dataType: 'json',
		success: function(result){
			thisR.data = result.data;
			thisR.type = result.dataType;

      if(thisR.type.columns) {
        thisR.type.columns = buildColumnsFromJSON(thisR.type.columns, "report");
      }

			thisR.userOptions = result.userOptions;
			thisR.user = result.user;
			thisR.initialize();
		},
		error: function(error, text){
			console.log(error);
			console.log(error.responseText);
		}
	});
};

Report.prototype.importSpark = function(row){
	var thisR = this;
	var data_row = Handsontable.hooks.run(thisR.handsontableHandler, 'modifyRow', row);
	var entry = thisR.currentData[data_row];

	if(!(typeof entry.manual == "string" && entry.manual.toLowerCase() == "true") && entry.manual != true
		&& typeof entry.ref == "string" && entry.ref != "" && typeof entry.source == "string" && entry.source != ""){
		thisR.pendingSpark += 1;
		var mapping = {
			"spark" : "sparksDeal",
			"eliot" : "eliotDeal",
			"x-one" : "xoneDeal"
		}
		var source = mapping[entry.source.toLowerCase()];
		$.ajax({
			url: "http://markeng.fr.world.socgen/mapping/" + source + "/" + entry.ref,
			dataType: 'json',
			statusCode: {
				200: function(result){
					console.log(result);
					if(typeof result == "object"){
						for (var key in result){
							entry[key] = result[key];
						}
						entry.import = 'done';
						entry.modified = true;
					}
					else{
						entry.import = 'error';
					}
				},
				404: function(result){
					console.log(result);
					entry.import = 'error';
					if(typeof result == "object"){
						entry.status = result.status;
					}
					else{
						entry.import = 'error';
					}
				}
			},
			error: function(error, text){
				console.log(error);
				console.log(error.responseText);
				entry.status = "TECHNICAL ERROR";
				entry.import = 'error';
			},
			complete: function(){
				thisR.pendingSpark -= 1;
				if(thisR.pendingSpark <= 0){
					thisR.handsontableHandler.render();
					if(!thisR.all){
						setTimeout(function() { thisR.handsontableHandler.validateCells(function(){}); }, Math.max(thisR.data.length, 100));
					}
					setTimeout(function() { thisR.handsontableHandler.render(); }, Math.max(2*thisR.data.length, 200));
				}
			}
		});
	}
};

Report.prototype.importGeo = function(row){
	var thisR = this;
	var data_row = Handsontable.hooks.run(thisR.handsontableHandler, 'modifyRow', row);
	var entry = thisR.currentData[data_row];

	if(!(typeof entry.manual == "string" && entry.manual.toLowerCase() == "true") && entry.manual != true && typeof entry.sales == "string"){
		thisR.pendingGeo += 1;
		if(typeof entry.tradeDate == "string"){
			var tradeDate = '/' + entry.tradeDate;
		}
		else{
			var tradeDate = '';
		}
		$.ajax({
			url: "http://markeng.fr.world.socgen/mapping/sales/" + entry.sales + tradeDate,
			dataType: 'json',
			success: function(result){
				console.log(result);
				if(typeof result == "object"){
					for (var key in result.desk){
						entry[key] = result.desk[key];
					}
				}
				else{
					entry.desk = 'undefined';
					entry.country = 'undefined';
					entry.zone = 'undefined';
				}
			},
			error: function(error, text){
				console.log(error);
				console.log(error.responseText);
				entry.desk = 'undefined';
				entry.country = 'undefined';
				entry.zone = 'undefined';
			},
			complete: function(){
				thisR.pendingGeo -= 1;
				if(thisR.pendingGeo <= 0){
					thisR.handsontableHandler.render();
					if(!thisR.all){
						setTimeout(function() { thisR.handsontableHandler.validateCells(function(){}); }, Math.max(thisR.data.length, 100));
					}
					setTimeout(function() { thisR.handsontableHandler.render(); }, Math.max(2*thisR.data.length, 200));
				}
			}
		});
	}
};

Report.prototype.initialize = function(){
	var thisR = this;
	// Titles
	$('#report-title').html(thisR.type.name);
	document.title = thisR.type.name;
	$('.data-report-name').html(thisR.type.name.toLowerCase());

	// Cameleon mode
	if((typeof thisR.user.teamWrite == "object" && thisR.user.teamWrite.length > 0) || (typeof thisR.user.teamRead == "object" && thisR.user.teamRead.length > 0)){
		var list = [];
		if(typeof thisR.user.teamWrite == "object" && thisR.user.teamWrite.length > 0){
			list = list.concat(thisR.user.teamWrite);
		}
		if(typeof thisR.user.teamRead == "object" && thisR.user.teamRead.length > 0){
			list = list.concat(thisR.user.teamRead);
		}
		list = uniq(list);
		list.sort();
		list.forEach(function(user){
			$("#cmd-cameleon select").append($('<option></option>').attr('value',user).text(user));
		});
		$("#cmd-cameleon select").prop("selectedIndex", -1);
		if(typeof thisR.cameleon == "string"){
			$("#cmd-cameleon select").prop("selectedIndex", list.indexOf(thisR.cameleon));
		}
		$("#cmd-cameleon select").change(function(){
			post(".", {cameleon: $("#cmd-cameleon select").val()});
		});
		$("#cmd-cameleon-cancel").click(function(){
			window.location.href = '.';
		});
		$("#cmd-cameleon").show();
	}


	// Info markdown
	$('#modal-info-markdown').html(marked(reportMarkdown[thisR.type.code]));

	// Fixed columns
	thisR.fixedColumnsLeft = thisR.type.fixedColumnsLeft;

	// Column width and headers
	thisR.type.columnsWidth = thisR.type.columns.map(function(col){return col.width});
	thisR.type.columnsHeader = thisR.type.columns.map(function(col){return col.header});

	// Date formats
	thisR.DATE_FORMATS = ["YYYY-MM-DD", "DD/MM/YY", "DD/MM/YYYY", "D-M"];
	thisR.TARGET_FORMAT = "YYYY-MM-DD";

	// Columns
	thisR.columnsMap = {};
	thisR.type.columns.forEach(function(col, index){
		var backgroundColor = col.backgroundColor;
		var colType = col.type;
		if(col.dataType == 'time'){
			col.renderer = function(instance, TD, row, col, prop, value, cellProperties){
				var dateTime = moment(value, "X");
				if(dateTime.isValid()){
					$(TD).html(dateTime.format('YYYY-MM-DD'));
				}
				if(typeof backgroundColor == "string"){
					TD.style.backgroundColor = backgroundColor;
				}
			}
		}
		else if(col.dataType == "import"){
			col.renderer = function(instance, TD, row, col, prop, value, cellProperties){
				$(TD).css('text-align', 'center');
				if(value == "pending"){
					$(TD).html('<span class="glyphicon glyphicon-refresh" aria-hidden="true"></span>');
				}
				else{
					if(value == "done"){
						$(TD).html('<span class="glyphicon glyphicon-ok" aria-hidden="true"></span>');
						$(TD).css('color', 'green');
					}
					else if(value == "error"){
						$(TD).html('<span class="glyphicon glyphicon-remove" aria-hidden="true"></span>');
						$(TD).css('color', 'red');
					}
					else{
						$(TD).html('<span class="glyphicon glyphicon-download" aria-hidden="true"></span>');
					}
					$(TD).off().dblclick(function(event){
						event.stopImmediatePropagation();
						thisR.importSpark(row);
					});
				}
				if(typeof backgroundColor == "string"){
					TD.style.backgroundColor = backgroundColor;
				}
			}
		}
		else if(col.type == "checkbox"){
			col.renderer = function(instance, TD, row, col, prop, value, cellProperties){
				Handsontable.renderers.CheckboxRenderer(instance, TD, row, col, prop, value, cellProperties);
				$(TD).css('text-align', 'center');
				if(typeof backgroundColor == "string"){
					TD.style.backgroundColor = backgroundColor;
				}
			}
		}
		else if(typeof backgroundColor == "string"){
			col.renderer = function(instance, TD, row, col, prop, value, cellProperties){
				Handsontable.renderers.getRenderer(colType ? colType == "dropdown" || colType == "date" ? "autocomplete" : colType : "text")(instance, TD, row, col, prop, value, cellProperties);
				TD.style.backgroundColor = backgroundColor; //col.backgroundColor;
			}
		}

		// Date validator
		if(col.type == "date"){
			col.validator = function (value, callback) {
				callback(moment(value, thisR.DATE_FORMATS).isValid());
			}
		}
		// Columns map
		thisR.columnsMap[col.data] = col;
	});

	// Business dropdown
	var business_short = uniq(thisR.columnsMap.business.source.map(function(biz){
		return biz.split(' ')[0];
	}));
	var business_dropdown = business_short.concat(thisR.columnsMap.business.source);

	// Show all
	if(typeof thisR.user.access == "object" && (thisR.user.access.indexOf("ADMIN") >= 0 || thisR.user.access.indexOf("SUPERADMIN") >= 0 || thisR.user.access.indexOf("SUPERVIEWER") >= 0)){
		if(thisR.all){
			$($('#cmd-show-all button')[0]).attr('class', 'btn btn-warning btn-sm');
			$($('#cmd-show-all button')[1]).attr('class', 'btn btn-warning dropdown-toggle btn-sm');
			$($('#cmd-show-all button')[0]).click(function(){post(".", {});});
		}
		else{
			$($('#cmd-show-all button')[0]).click(function(){post(".", {showAll: true});});
		}

		business_dropdown.forEach(function(biz) {
			var link = $('<a href="#"></a>').html(biz).click(function(){post(".", {showAll: biz});});
			if(thisR.all == biz){
				link.attr('class', 'btn-warning');
			}
			$("#cmd-show-all ul").append($('<li></li>').append(link));
		});
		if(typeof thisR.all == "string"){
			$('#cmd-search-box').val(thisR.all);
		}
		$('#cmd-show-all').show();
		if(typeof thisR.all == "string"){
			$('#cmd-search-box').val(thisR.all);
		}
	}

	// Show team
	if(thisR.team){
		$($('#cmd-show-team button')[0]).attr('class', 'btn btn-warning btn-sm');
		$($('#cmd-show-team button')[1]).attr('class', 'btn btn-warning dropdown-toggle btn-sm');
		$($('#cmd-show-team button')[0]).click(function(){post(".", {});});
	}
	else{
		$($('#cmd-show-team button')[0]).click(function(){post(".", {showTeam: true});});
	}
	business_dropdown.forEach(function(biz) {
		var link = $('<a href="#"></a>').html(biz).click(function(){post(".", {showTeam: biz});});
		if(thisR.team == biz){
			link.attr('class', 'btn-warning');
		}
		$("#cmd-show-team ul").append($('<li></li>').append(link));
	});
	if(typeof thisR.team == "string"){
		$('#cmd-search-box').val(thisR.team);
	}

	// Copy header to clipboard
	var clipboardClient = new ZeroClipboard($("#cmd-copy-header"));
	clipboardClient.on( "copy", function (event) {
		var clipboard = event.clipboardData;
		var rtfString = "";
		thisR.type.columnsHeader.forEach(function(header, index){
			rtfString += (index > 0 ? "\t" : "") + header;
		});
		clipboard.setData( "text/plain", rtfString );
		clipboard.setData("application/rtf", "{\\rtf1\\ansi\deff0" + rtfString + "}}");
	});

	// Handsontable
	//thisR.currentData = thisR.data.filter(function(entry){return !entry.deleted; });
	thisR.search(true);
	$('#handsontable-container').handsontable({
		data: thisR.currentData,
		minSpareRows: 1,
		colHeaders: thisR.type.columnsHeader,
		rowHeaders: true,
		currentRowClassName: 'currentRow',
		columnSorting: true,
		renderAllRows: !thisR.all,
		renderAllColumns: !thisR.all,
		fixedColumnsLeft: thisR.type.fixedColumnsLeft,
		colWidth: thisR.columnsWidth,
		columns: thisR.type.columns.unshell(),
		contextMenu: ['row_above', 'row_below', 'remove_row'],
		afterInit: function(){
			thisR.handsontableHandler = $('#handsontable-container').handsontable('getInstance');
			if(!thisR.all){
				setTimeout(function() { thisR.handsontableHandler.validateCells(function(){}); }, Math.max(thisR.data.length, 100));
			}
			setTimeout(function() { thisR.handsontableHandler.render(); }, Math.max(2*thisR.data.length, 200));
		},
		beforeKeyDown: function(event){
			if(event.keyCode == 13){
				var selected = thisR.handsontableHandler.getSelected();
				if(selected[1] == 3 && selected[3] == 3){
					for(i = Math.min(selected[0], selected[2]); i < Math.max(selected[0], selected[2]) + 1; i++) {
						thisR.importSpark(i);
					}
				}
			}
		},
		afterChange: function(change, source){
			var modified = false;
			if(source == "edit" || source == "paste"){
				if(Object.prototype.toString.call(change) == "[object Array]"){
					change.forEach(function(entry){
						var row = Handsontable.hooks.run(thisR.handsontableHandler, 'modifyRow', entry[0])
						//var column_code = thisR.columnsMap[entry[1]].data;
						var column_code = entry[1];
						var entry_data = thisR.currentData[row];
						if(entry[2] != entry[3] && column_code != 'import'){
							entry_data.modified = true;
						}
						// Fugit
						if(column_code == "tradeDate" || column_code == "matDate"){
							var tradedate = moment(entry_data.tradeDate, "YYYY-MM-DD"),
								strikedate = moment(entry_data.strikeDate, "YYYY-MM-DD"),
								matdate = moment(entry_data.matDate, "YYYY-MM-DD");
							if (strikedate==""){ startperiod = tradedate; }
							else { startperiod = strikedate; }
							T_in_years = matdate.diff(startperiod, "days", true)/365;
							entry_data.fugit = T_in_years;
							modified = true;
							entry_data.modified = true;
						}
						// Nominal EUR
						if(column_code == "nominal" || column_code == "FX"){
							entry_data.nominalEur = (parseFloat(entry_data.nominal) || 0) * (parseFloat(entry_data.FX) || 0);
							modified = true;
							entry_data.modified = true;
						}
						// Sales Credit Upfront
						if(column_code == "marginPct" || column_code == "nominalEur" || column_code == "nominal" || column_code == "FX"){
							entry_data.marginEur = (parseFloat(entry_data.marginPct) || 0) * (parseFloat(entry_data.nominalEur) || 0);
							modified = true;
							entry_data.modified = true;
						}
						// Sales Credit Running
						if(column_code == "marginRunningPct" || column_code == "nominalEur" || column_code == "nominal" || column_code == "FX"){
							var strikedate = moment(entry_data.strikeDate, "YYYY-MM-DD"),
								matdate = moment(entry_data.matDate, "YYYY-MM-DD"),
								yearstart = moment("2014-12-31", "YYYY-MM-DD"),
								yearend = moment("2015-12-31", "YYYY-MM-DD"),
								startperiod = strikedate.diff(yearstart, "days", true) > 0 ? strikedate: yearstart,
								endperiod = yearend.diff(matdate, "days", true) > 0 ? matdate: yearend,
								T_in_days = endperiod.diff(startperiod, "days", true);
							entry_data.marginRunningEur = (parseFloat(entry_data.marginRunningPct) || 0) * (parseFloat(entry_data.nominalEur) || 0) * T_in_days/365;
							modified = true;
							entry_data.modified = true;
						}
						// Sales Credit
						if(column_code == "marginRunningPct" || column_code == "marginPct" || column_code == "marginEur"
							|| column_code == "marginRunningEur" || column_code == "TEC" || column_code == "FTEC"
							|| column_code == "nominalEur" || column_code == "nominal" || column_code == "FX"){
							entry_data.netMarginEur = (parseFloat(entry_data.nominalEur) || 0) * ((parseFloat(entry_data.marginPct) || 0) + (parseFloat(entry_data.TEC) || 0) * (parseFloat(entry_data.FTEC) || 0)) + (parseFloat(entry_data.marginRunningEur) || 0);
							entry_data.netMarginPct = (parseFloat(entry_data.netMarginEur) || 0) / (parseFloat(entry_data.nominalEur) || 0);
							modified = true;
							entry_data.modified = true;
						}
						if(column_code == "netMarginEur"){
							entry_data.netMarginPct = (parseFloat(entry_data.netMarginEur) || 0) / (parseFloat(entry_data.nominalEur) || 0);
							modified = true;
							entry_data.modified = true;
						}
						// Sales (for geographic fields: desk, country, zone)
						if(column_code == "sales" && entry_data.sales != ""){
							thisR.importGeo(entry[0]);
							entry_data.modified = true;
						}
					});
				}
			}
			if(source == "paste" || modified){
				thisR.handsontableHandler.validateCells(function(){});
				setTimeout(function() { thisR.handsontableHandler.render(); }, 100);
			}
		},
		beforeChange: function(change, source){
			if(Object.prototype.toString.call(change) == "[object Array]"){
				change.forEach(function(entry){
					// Post processing
					if(source == "edit" || source == "paste"){
						// Format date
						console.log(entry);
						if(thisR.columnsMap[entry[1]].type == "date"){
							entry[3] = moment(entry[3], thisR.DATE_FORMATS).format(thisR.TARGET_FORMAT);
						}
						// Format numbers
						if(thisR.columnsMap[entry[1]].dataType == "numeric"){
							entry[3] = numeral(entry[3]).value();
						}
						// Format checkbox
						if(thisR.columnsMap[entry[1]].type == "checkbox"){
							if(typeof entry[3] == "string"){
								entry[3] = entry[3].toLowerCase();
							}
						}
					}
				});
			}
		},
		beforeRemoveRow: function(index, amount){
			for(i=index;i<index+amount;i++){
				thisR.currentData[i].deleted = true;
			}
		},
		afterCreateRow: function(index, amount){
			for(i=index;i<index+amount;i++){
				thisR.data.push(thisR.currentData[i]);
			}
		},
		afterSelection: function(r, c, r2, c2){
			// Focus on cell
			if(c > 0){
				var element = thisR.handsontableHandler.getCell(r2, c2);
				a = element;
				var offset = $(element).offset().left + $(element).outerWidth() - $(window).scrollLeft() - $('body').innerWidth();
				var fixedColumnsLeft = thisR.fixedColumnsLeft;
				if(c >= fixedColumnsLeft){
					var lastFixedColumn = thisR.handsontableHandler.getCell(r2, fixedColumnsLeft-1);
					var right_shift = $(lastFixedColumn).offset().left + $(lastFixedColumn).outerWidth();
				}
				else{
					var right_shift = 0;
				}
				var right_offset = $(element).offset().left - $(window).scrollLeft() - right_shift;
				if(offset > 0){
					$(window).scrollLeft(offset + $(window).scrollLeft());
				}
				else if(right_offset < 0){
					$(window).scrollLeft(right_offset + $(window).scrollLeft());
				}
			}
		}
	});


	// Commands
	// __Discard changes
	$('#cmd-confirm-discard').click(function(){
		location.reload();
	});
	// __Show changes before saving
	$('#cmd-save').click(function(){
		var beforeSave = thisR.beforeSave();
		$('#data-nb-add').html(beforeSave.createdData.length);
		$('#data-nb-update').html(beforeSave.modifiedData.length);
		$('#data-nb-delete').html(beforeSave.deletedData.length);
		$('#modal-save').modal('show');
	});
	// __Save
	$('#cmd-confirm-save').click(function(){thisR.save();});
	// Search button
	$('#cmd-search-box').keydown(function(event){
		if(event.keyCode == 13) {
			event.preventDefault();
			thisR.search(false);
			return false;
		}
		//thisR.search();
	});
};

Report.prototype.save = function(){
	var thisR = this;
	var modifiedData = thisR.data.filter(function(entry){return entry.modified;});
	if(modifiedData.length == 0){
		$('#modal-save').modal('hide');
		return true;
	}
	$('#cmd-confirm-save').button('loading');

	// Remove import
	modifiedData.forEach(function(entry){
		if(entry.import == 'error'){
			delete entry.status;
		}
		delete entry.import;
	});

	console.log(modifiedData);
	$.ajax({
		type: "POST",
		url: thisR.urlData,
		data: {type: 'report', request: 'save', dataType: thisR.type.code, data: modifiedData, cameleon: thisR.cameleon},
		success: function(result){
			$('#cmd-confirm-save').button('reset');
			//console.log(result);
			location.reload();
		},
		error: function(error, text){
			console.log(error);
			console.log(error.responseText);
		}
	});
};

Report.prototype.beforeSave = function(){
	var thisR = this;
	var result = {createdData: [], modifiedData: [], deletedData: []};
	thisR.data.forEach(function(entry){
		var empty = thisR.isEntryEmpty(entry);
		var exist = typeof entry.dbId != "undefined" && entry.dbId != null && entry.dbId != "";
		if(!exist && !empty){
			result.createdData.push(entry);
		}
		else if(exist && !empty && entry.modified && !entry.deleted){
			result.modifiedData.push(entry);
		}
		else if(exist && (empty || entry.deleted)){
			result.deletedData.push(entry);
			entry.modified = true;
			entry.deleted = true;
		}
		else if(!exist && empty){
			entry.modified = false;
		}
	});
	return result;
};

Report.prototype.isEntryEmpty = function(entry){
	var thisR = this;
	var answer = true;
	thisR.type.columns.forEach(function(col){
		var value = entry[col.data];
		if(value != undefined && value != "" && value != null && !col.readOnly && !(col.type == "checkbox") && !(col.type == "dropdown")){
			answer = false;
		}
	});
	return answer;
};

/*
	---------------
	SEARCH
	---------------
*/

Report.prototype.search = function(init){
	var thisR = this;
	var keyword = $('#cmd-search-box').val();
	// Clean data
	thisR.cleanData();
	// Filter data
	if(typeof keyword == undefined || keyword == ''){
		thisR.currentData = thisR.data.filter(function(entry){ return !entry.deleted; });
	}
	else{
		var keywords = keyword.split(' ');
		thisR.currentData = thisR.data.filter(function(entry){
			if(entry.deleted){ return false; }
			return keywords.every(function(kwd){
				var regKwd = new RegExp(kwd, "i");
				return thisR.type.columns.some(function(col){
					return (typeof entry[col.data] == "string" ? entry[col.data].search(regKwd) >= 0 : false);
				});
			});
		});
	}
	if(!init){
		thisR.handsontableHandler.loadData(thisR.currentData);
	}
	//setTimeout(function() { thisR.handsontableHandler.render(); }, 100);
};

Report.prototype.cleanData = function(){
	var thisR = this;
	thisR.data.forEach(function(entry){
		var empty = thisR.isEntryEmpty(entry);
		var exist = typeof entry.dbId != "undefined" && entry.dbId != null && entry.dbId != "";
		if(!exist && empty){
			var index = thisR.data.indexOf(entry);
			thisR.data.splice(index, 1);
		}
	});
};
