// ==UserScript==
// @name        Extract images for pixiv
// @name:zh     P站原图收割机
// @namespace   https://github.com/cmheia/extract-images-for-pixiv
// @description Adds a button that get all attached images as original size to every post.
// @include     http://www.pixiv.net/member_illust.php*
// @author      cmheia
// @version     0.0.1
// @icon        http://www.pixiv.net/favicon.ico
// @grant       GM_setClipboard
// @license     MPL
// ==/UserScript==
(function () {
	// AJAX lib
	var AJAX_FINISHED           =  0;
	var AJAX_NO_BROWSER_SUPPORT = -1;
	var AJAX_STARTING           = -2;
	var AJAX_PARTIAL_PROGRESS   = -3;
	var AJAX_FAILED             = -4;
	var getXHR = function () {
		var xhr = false;
		if (window.XMLHttpRequest) {
			xhr = new XMLHttpRequest();
		}
		if (!xhr) {
			return false;
		}
		return xhr;
	};

	var makeRequest = function (url, requestType, payload, callback) {
		if (typeof callback !== "function") {
			alert("说好的回调呢 ٩͡[๏̯͡๏]");
			return false;
		}
		var xhr = getXHR();
		if (xhr) {
			xhr.onreadystatechange = function () {
				if (xhr.readyState == 4) {
					if (xhr.status == 200) {
						callback(xhr, AJAX_FINISHED);
					} else {
						callback(xhr, AJAX_FAILED);
					}
				}
			};
			xhr.open(requestType, url, true);
			if (requestType == "POST") {
				xhr.setRequestHeader("Content-Type","application/x-www-form-urlencoded;");
			}
			xhr.send(payload);
			callback(xhr, AJAX_STARTING);
		} else {
			callback(xhr, AJAX_NO_BROWSER_SUPPORT);
		}
		return xhr;
	};

	// 移除分享按钮
	var removeShareButton = function () {
		var share_button = document.getElementsByClassName('share-button')[0];
		var count = share_button.childNodes.length;
		for (var i = 0; i < count; i++) {
			share_button.removeChild(share_button.childNodes[0]);
		}
	};

	// 取得图集信息
	var isMulti = function () {
		// 单图特征: thumbnail === "A" && albumMeta === (\d+)×(\d+)
		// 多图特征: thumbnail === "A" && albumMeta === "一次性投稿多张作品 "(\d+)"P"
		// 多图特征: thumbnail === "A" && albumMeta === "複数枚投稿 "(\d+)"P"
		// 多图特征: thumbnail === "A" && albumMeta === "Multiple images: "(\d+)"P"
		// 多图特征: thumbnail === "A" && albumMeta === "여러 장 투고 "(\d+)"P"
		var thumbnail = document.getElementsByClassName('works_display')[0].childNodes[0].nodeName;
		var albumMeta = document.getElementsByClassName('meta')[0].childNodes[1].innerHTML;
		var regExp0 = new RegExp(/(\d+)×(\d+)/, "gi");
		var regExp1 = new RegExp(/(\d+)/, "gi");
		if ("A" === thumbnail) {
			var p = albumMeta.match(regExp1);
			if (null !== p) {
				return parseInt(p[0]);
			} else {
				return -1;
			}
		} else {
			if (albumMeta.match(regExp0)) {
				return 0;
			} else {
				return -1;
			}
		}
		return -1;
	};

	// 添加按钮
	var addButton = function () {
		var button = document.createElement('li');
		button.innerHTML="<a id='extract' href='javascript:;' style='margin:0 8px;'>收割 ๑乛◡乛๑ (●´∀｀●)</a><span id='extracted'></span>";
		button.addEventListener("click", function () {
			var onUnique = function (arr) {
				var result = [], hash = {};
				for (var i = 0, elem; (elem = arr[i]) !== undefined; i++) {
					if (!hash[elem]) {
						result.push(elem);
						hash[elem] = true;
					}
				}
				return result;
			};
			var extractSingle = function (src) {
				var regex = new RegExp(/((http|https):\/\/)+(\w+\.)+(\w+)[\w\/\.\-]*(jpg|jpeg|gif|png|webp)/, "gi");
				var result = src.match(regex);
				if (null === result || 1 !== result.length) {
					return null;
				}
				return result[0];
			};
			var extractMulti = function (num) {
				var targetPagePattern = window.location.href.replace(/medium/, "manga_big") + "&page=";
				var targetPage = [];
				var imageUrls = [];
				var parsedCounts = 0;
				var parseRespond = function (xhr, status) {
					if (xhr){
						if (AJAX_FINISHED === status) {
							var imageUrl = extractSingle(xhr.response);
							if (null !== imageUrl) {
								imageUrls.push(imageUrl);
							}
							parsedCounts++;
						} else if (AJAX_FAILED === status) {
							parsedCounts++;
						}
						if (num === parsedCounts) {
							document.getElementById("extracted").innerHTML = "搞到这 " + illustType + " 张图啦 （⺻▽⺻ ）";
							GM_setClipboard(imageUrls.sort().join("\r\n"));
						}
					}
				};
				for (var i = 0; i < num; i++) {
					targetPage.push(targetPagePattern + i);
				}
				targetPage = onUnique(targetPage);
				for (var j = 0; j < targetPage.length; j++) {
					makeRequest(targetPage[j], "GET", null, parseRespond);
				}
				return targetPage.length;
			};

			var message = document.getElementById("extracted");
			var illustType = isMulti();
			if (0 === illustType) {
				var result = extractSingle(document.getElementsByClassName('original-image')[0].getAttribute("data-src"));
				if (null !== result) {
					message.innerHTML = "搞到这张图啦 （⺻▽⺻ ）";
					GM_setClipboard(result);
				} else {
					message.innerHTML = "然而并不能收割 (╯#-_-)╯~~~~~~~~~~~~~~~~~╧═╧";
				}
			} else if (0 < illustType) {
				if (0 === extractMulti(illustType)) {
					message.innerHTML = "然而并不能收割 (╯#-_-)╯~~~~~~~~~~~~~~~~~╧═╧";
				} else {
					message.innerHTML = "正在搞这 " + illustType + " 张图，不要急嘛 (๑•̀_•́๑)";
				}
			} else {
				message.innerHTML = "P站又改版了 (╯#-_-)╯~~~~~~~~~~~~~~~~~╧═╧";
			}
		});
		document.getElementsByClassName('share-button')[0].appendChild(button);
	};

	// 运行
	removeShareButton();
	addButton();
}) ();
