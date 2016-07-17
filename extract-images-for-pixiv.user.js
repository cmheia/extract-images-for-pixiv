// ==UserScript==
// @name        Extract images for pixiv
// @name:zh     P站原图收割机
// @namespace   https://github.com/cmheia/extract-images-for-pixiv
// @description Adds a button that get all attached images as original size to every post.
// @include     http://www.pixiv.net/member_illust.php*
// @author      cmheia
// @version     1.0.0
// @icon        http://www.pixiv.net/favicon.ico
// @grant       GM_setClipboard
// @grant       GM_xmlhttpRequest
// @license     MPL
// ==/UserScript==
(function () {
	/**********************************************************************
	 * 长得像库
	 **********************************************************************/
	var $id = function (o) {
		return document.getElementById(o);
	};

	var $class = function (o) {
		return document.getElementsByClassName(o);
	};

	// 去重
	var unique = function (arr) {
		var result = [],
		hash = {};
		for (var i = 0, elem; (elem = arr[i]) !== undefined; i++) {
			if (!hash[elem]) {
				result.push(elem);
				hash[elem] = true;
			}
		}
		return result;
	};

	// 插入样式表
	var apendStyle = function (cssText) {
		var head = document.head || document.getElementsByTagName('head')[0];
		var style = document.createElement('style');
		style.type = 'text/css';
		var textNode = document.createTextNode(cssText);
		style.appendChild(textNode);
		head.appendChild(style);
	};

	// 增加 class
	var addClassName = function (elem, clas) {
		var current = elem.className;
		if (current) {
			current += " ";
			current += clas;
			current = current.split(' ').filter(function (v, i) {
				if (v) {
					return v;
				}
			});
			current = unique(current);
			elem.className = current.join(" ");
		} else {
			elem.className = clas;
		}
	};

	// 移除 class
	var removeClassName = function (elem, clas) {
		var current = elem.className;
		if (current) {
			current = current.split(' ').filter(function (v, i) {
				if (clas != v) {
					return v;
				}
			});
			current = unique(current);
			elem.className = current.join(" ");
		}
	};

	// 增加/移除 class
	var toggleClassName = function (elem, clas) {
		var current = elem.className;
		if (current) {
			if (-1 === current.split(' ').indexOf(clas)) {
				addClassName(elem, clas);
			} else {
				removeClassName(elem, clas);
			}
		} else {
			elem.className = clas;
		}
	};

	// 伤脑筋！
	function illustCollector() {

		function tergetContainer() {
			// illust_id
			this.id = -1;
			// 取得的原图链接
			this.result = [];
			// 最终的原图链接,1 -> yes,0 -> no,-1 -> failed
			this.final = [];
		}

		this.illust = [];

		// 删除重复目标
		this.shrinkTarget = function () {
			var i,
			elem,
			hash = {},
			duplicate = [];
			// 第一步：找出需要删除的重复 id
			for (i = 0; (elem = this.illust[i]) !== undefined; i++) {
				if (hash[elem.id]) {
					duplicate.push(i); // 重复
				} else {
					hash[elem.id] = true;
				}
			}
			// 第二步：删除的重复 id
			for (i = duplicate.length - 1; i >= 0; i--) {
				this.illust.splice(duplicate[i], 1);
			}
			// console.log("删除重复 id", duplicate.length, "个");
			return duplicate.length;
		};

		// 增加新目标
		this.addTarget = function (illust_id) {
			console.group("addTarget", illust_id, this.illust.length);
			var i,
			index;
			for (i = 0; i < this.illust.length; i++) {
				if (illust_id === this.illust[i].id) {
					console.log("目标重复了");
					index = -1;
					break;
				}
			}
			if (-1 !== index) {
				this.shrinkTarget();
				index = this.illust.length;
				// console.log("新增目标", index, this.illust.length);
				this.illust.push(new tergetContainer());
				// illust_id
				this.illust[index].id = illust_id;
			}
			// console.log(index, this.illust);
			console.groupEnd();
			return index;
		};

		// 删除目标
		// type: true -> target is id; false -> target is index (default)
		this.removeTarget = function (target, type) {
			console.group("removeTarget", target, type);
			var i,
			index = -1;

			if (type) {
				for (i = 0; i < this.illust.length; i++) {
					if (target === this.illust[i].id) {
						index = i;
						break;
					}
				}
			} else {
				index = target;
			}
			if (index > -1) {
				this.illust.splice(index, 1);
			}
			console.groupEnd();
		};

		// 记录指定 illust_id 包含的图片数量(取得目标 html 后调用)
		// count: -1 -> 记录为失败
		// type: true -> target is index; false -> target is id (default)
		this.recordTargetLength = function (target, count, type) {
			console.group("recordTargetLength", target, count, type);
			var i,
			index = -1;

			if (type && this.illust[target] && this.illust[target].id) {
				index = target;
			} else {
				for (i = 0; i < this.illust.length; i++) {
					if (target === this.illust[i].id) {
						index = i;
						break;
					}
				}
			}
			if (index > -1) {
				if (0 > count) {
					// 记录为失败
					// 取得的原图链接
					// this.illust[index].result[0] = "";
					// 最终的原图链接,1 -> yes,0 -> no,-1 -> failed
					this.illust[index].final[0] = -1;
					console.log(target, "被标记为获取失败,index =", index);
				} else {
					// 取得的原图链接
					this.illust[index].result = new Array(count);
					// 最终的原图链接,1 -> yes,0 -> no,-1 -> failed
					this.illust[index].final = new Array(count);
					console.log("初始化 illust[", index, "] 为", count, "个原图存放区");
				}
			}
			console.groupEnd();
		};

		// 记录指定 illust_id 的原图 URL (取得目标的原图后调用, 每次调用添加一个 URL, 多图多调)
		// type: true -> target is index; false -> target is id (default)
		this.setTarget = function (target, content, offset, status, type) {
			console.group("setTarget", target, content, offset, status, type);
			var i,
			index = -1,
			result = false;

			if (type && this.illust[target] && this.illust[target].id) {
				index = target;
			} else {
				for (i = 0; i < this.illust.length; i++) {
					if (target === this.illust[i].id) {
						index = i;
						break;
					}
				}
			}
			if (index > -1) {
				if (offset < this.illust[index].final.length) {
					console.log("记录第", offset, "个原图", content, "到", index);
					// 取得的原图链接
					this.illust[index].result[offset] = content;
					// 最终的原图链接,1 -> yes,0 -> no,-1 -> failed
					this.illust[index].final[offset] = parseInt(status);
					result = true;
				} else {
					console.log(offset, "已越界");
				}
			}
			console.groupEnd();
			return result;
		};

		// 完工？
		// final[],1 -> yes,0 -> no,-1 -> failed
		// 遍历所有 final, 发现 0 即为未完成
		this.isAllDone = function () {
			console.group("isAllDone", this.illust.length);
			var i,
			j,
			working = false;

			console.group("lopop illust[]");
			for (i = 0; i < this.illust.length && !working; i++) {
				console.log("illust[", i, "]: id =", this.illust[i].id, ", final.length =", this.illust[i].final.length);
				if (0 === this.illust[i].final.length) {
					working = true;
					console.warn("final.length=0, 即还未记录结果, 属未完成");
					break;
				}
				for (j = 0; j < this.illust[i].final.length && !working; j++) {
					console.log("\tfinal[", j, "] =", this.illust[i].final[j]);
					if (0 === this.illust[i].final[j]) {
						working = true;
						console.warn("illust[", i, "].final[", j, "] = 0, 还未完成");
						break;
					}
				}
			}
			console.groupEnd();
			if (working) {
				console.warn("在忙");
			} else {
				console.warn("完工！！！");
			}
			console.groupEnd();
			return !working;
		};

		// 导出结果
		this.exportAll = function () {
			console.group("exportAll");
			var i,
			j,
			k,
			total = 0,
			failed = new Array(this.illust.length),
			src = [],
			result = {};

			for (i = 0; i < this.illust.length; i++) {
				for (j = 0, k = 0; j < this.illust[i].final.length; j++) {
					if (1 === this.illust[i].final[j]) {
						src[total++] = this.illust[i].result[j];
						k++;
					}
				}
				failed[i] = j - k;
				console.log("illust[", i, "]导出", k, "个,失败", failed, "个");
			}
			console.log("共导出", total, "个");
			result.fail = failed;
			result.done = src;
			console.groupEnd();
			return result;
		};

		// 导出 ID
		this.getID = function () {
			console.group("getID");
			var i,
			result = [];

			for (i = 0; i < this.illust.length; i++) {
				result[i] = this.illust[i].id;
			}
			console.groupEnd();
			return result;
		};
	}

	/**********************************************************************
	 * 基础设施
	 **********************************************************************/
	// 页面显示信息
	var msg = function (msg) {
		$id("extracted").innerHTML = msg;
	};

	// 创建样式表
	var addStyle = function () {
		apendStyle(".cmheia_checkbox {position:absolute;left:0;} .cmheia_item {padding:1px 1px 7px;} .cmheia_item_selected {background-color:pink;}");
	};

	// 作品目录？
	var isWorksList = function () {
		console.group('页面类型');
		var userId,
		workId;

		userId = window.location.search.match(/\?id=(\d+)/);
		workId = window.location.search.match(/\&illust_id=(\d+)/);
		if (userId) {
			console.log("作品目录,USER ID:", userId[1]);
		}
		if (workId) {
			console.log("作品页面,WORK ID:", workId[1]);
		}
		console.groupEnd();
		return null !== userId && null === workId;
	};

	// 匹配单个图片链接
	var parseImageUrl = function (src) {
		var result = src.match(/((http|https):\/\/)+(\w+\.)+(\w+)[\w\/\.\-]*(jpg|jpeg|gif|png|webp)/gi);
		if (null === result || 1 !== result.length) {
			return null;
		}
		return result[0];
	};

	// 提取多图页面原图链接
	var parseMultiImageUrl = function (num, target, callback) {
		console.group("parseMultiImageUrl", num, target);
		console.log(callback);
		var i,
		parsed = 0,
		result = {};

		result.done = new Array(num);
		result.fail = new Array(num);
		for (i = 0; i < num; i++) {
			console.log(target + i);
			// 下面闭包的 index 无实际必要,
			// xhr.finalUrl.replace(/.*(page=\d+)/, "$1") 可取得相同的值,
			// 然而
			// 听说闭包很深奥,那就多练练
			GM_xmlhttpRequest({
				method : 'GET',
				url    : target + i,
				onload : (function (xhr) {
					var index = i;
					return function (xhr) {
						var src;
						if (200 === xhr.status) {
							src = parseImageUrl(xhr.response);
							if (null !== src) {
								result.done[index] = src;
							}
						}
						console.log("parseMultiImageUrl:onload", xhr.finalUrl.replace(/.*(page=\d+)/, "$1"), parsed, src, result);
						if (++parsed === num) {
							callback(result);
						}
					};
				})(),
				onerror: (function (xhr) {
					var index = i;
					return function (xhr) {
						console.log("parseMultiImageUrl:onerror", xhr.finalUrl.replace(/.*(page=\d+)/, "$1"));
						result.fail[index] = xhr.finalUrl;
						if (++parsed === num) {
							callback(result);
						}
					};
				})()
			});
		}
		console.groupEnd();
		return num;
	};

	/**********************************************************************
	 * 作品目录页面功能
	 **********************************************************************/
	// 解析详情页链接
	var extractIllustUrl = function () {
		console.group("extractIllustUrl");
		var i,
		href,
		id = [],
		itemList = $class("_image-items")[0].children;

		if (itemList) {
			for (i = 0; i < itemList.length; i++) {
				if (itemList[i].children[0].children[0].children[1].checked) {
					href = itemList[i].children[1].getAttribute('href');
					if (href && href.match(/.*illust_id=(\d+).*/)) {
						// id.push(href.replace(/.*illust_id=(\d+).*/, "$1") || "");
						id.push(href);
					}
				}
			}
		}
		console.groupEnd();
		return id;
	};

	// 选中全部图片
	var ctrlSelectAll = function () {
		console.group("ctrlSelectAll");
		var i,
		itemList = $class("_image-items")[0].children;

		if (itemList) {
			for (i = 0; i < itemList.length; i++) {
				itemList[i].children[0].children[0].children[1].checked = !0;
			}
		}
		console.groupEnd();
	};

	// 反选
	var ctrlSelectInvert = function () {
		console.group("ctrlSelectInvert");
		var i,
		itemList = $class("_image-items")[0].children;

		if (itemList) {
			for (i = 0; i < itemList.length; i++) {
				var x = itemList[i].children[0].children[0].children[1].checked;
				itemList[i].children[0].children[0].children[1].checked = !x;
			}
		}
		console.groupEnd();
	};

	// 提取指定页面
	var fetchPageContent = function (arr, prefix, onload, onerror) {
		console.group('fetchPageContent');
		var i;

		for (i = 0; i < arr.length; i++) {
			// 听说闭包很深奥,那就多练练
			var target = arr[i].replace(/.*illust_id=(\d+).*/, "$1");
			console.log(target);
			GM_xmlhttpRequest({
				method : 'GET',
				url    : prefix + arr[i],
				onload : (function (xhr) {
					var id = target;
					return function (xhr) {
						onload(id, xhr);
					};
				})(),
				onerror: (function (xhr) {
					var id = target;
					return function (xhr) {
						onerror(id, xhr);
					};
				})()
			});
		}
		console.groupEnd();
	};

	// 从 html 源码提取原图链接
	// 先尝试作为单图解析,解析失败再作为图集解析,解析再次失败再作为动图解析
	// 返回：
	// 		单图 -> 原图链接(57565823);
	// 				 -> html 中包含字符串 "original-image"
	// 		多图 -> 包含原图的目标页面链接(第二个参数为此而生)(56207143);
	// 				 -> html 中包含字符串 "multiple"
	// 		动图 -> 原图压缩包链接(44588377,56083603)(动图仅包含单个 zip , 使用与单图相同的方法处理)
	// 				 -> html 中包含字符串 "ugoira_view"
	var parseWorkPage = function (html, url) {
		console.group("parseWorkPage");
		var i,
		imgTag,
		result = [];

		imgTag = html.match(/<img\s+alt=\"[^\"]*\".*data-src=\"([^\"]*)\".*class=\"original-image\">/);
		if (imgTag && imgTag[1]) {
			// 单图
			result[0] = imgTag[1];
			console.debug("单图", result);
		} else if (html.indexOf("multiple") && (imgTag = html.match(/<ul class=\"meta\"><li>[^<>]*<\/li><li>[^<>]*(\d+)P<\/li>/)) && imgTag && imgTag[1]) {
			// 多图
			// http://www.pixiv.net/member_illust.php?mode=manga_big&illust_id=xxxxxxxx&page=0
			result.push(parseInt(imgTag[1]));
			result.push(url.replace(/medium/, "manga_big") + "&page=");
			console.debug("多图", result);
		} else if (html.indexOf("ugoira_view") && (imgTag = html.match(/pixiv\.context\.ugokuIllustFullscreenData[\s]*=[\s]*\{[\s]*\"src\"[\s]*:[\s]*\"((http|https):[\\\/]*[\w\d\.]*pixiv\.net(.*)\/(\d+)_ugoira(\d+)x(\d+)\.zip)\",/)) && imgTag && imgTag[1]) {
			// 动图
			// http://www.pixiv.net/member_illust.php?mode=medium&illust_id=xxxxxxxx
			result[0] = imgTag[1].replace(/\\(.)/gi, '$1');
			console.debug("动图", result[0]);
		}
		// console.log("parseWorkPage", result);

		console.groupEnd();
		return result;
	};

	// 提取选定的原图
	var extractWorkList = function () {
		console.group("开始提取");
		var exportImages = function () {
			if (result.isAllDone()) {
				var i,
				info,
				arr,
				res = result.exportAll();

				console.debug("已采集原图:", res.done);
				console.debug("提取失败: ", res.fail);
				info = "搞到 " + res.done.length + " 张图啦 （⺻▽⺻ ）";
				arr = result.getID();
				for (i = res.fail.length - 1; i >= 0; i--) {
					if (0 === res.fail[i]) {
						arr.splice(i, 1);
					}
				}
				if (arr.length) {
					info += " 然而" + arr.toString() + "提取失败 (ಥ_ಥ)";
				}
				msg(info);
				GM_setClipboard(res.done.join("\r\n"));
			}
		};

		var recordFails = function (illustId, status) {
			console.error(illustId, "提取失败", status);
			msg(illustId + "提取失败 (ಥ_ಥ) [http " + status + "]");
			result.recordTargetLength(illustId, -1);
			result.setTarget(illustId, null, 0, -1);
		};

		var i,
		progress = 0,
		result,
		url = extractIllustUrl();

		if (0 === url.length) {
			msg("至少选择一张图吧 ◔ ‸◔？");
			console.groupEnd();
			return;
		}
		console.log("添加目标", url);
		result = new illustCollector();
		for (i = 0; i < url.length; i++) {
			result.addTarget(url[i].replace(/.*illust_id=(\d+).*/, "$1"));
		}
		fetchPageContent(url,
			window.location.origin,
			function (illustId, xhr) {
				var i,
				target;
				console.group("得到页面", illustId, ", 开始解析", illustId == xhr.finalUrl.replace(/.*illust_id=(\d+).*/, "$1"));
				progress++;
				msg("进度" + progress + "/" + url.length + " (ฅ´ω`ฅ)");

				if (200 === xhr.status) {
					// 解析页面取得原图链接(单图和动图)或新的目标页面链接(多图)
					target = parseWorkPage(xhr.responseText, xhr.finalUrl);
					if (target) {
						// 记录原图数量
						if (1 === target.length) {
							result.recordTargetLength(illustId, 1);
							// 单图和动图可立即取得原图链接,那就顺手录入,并标记为已完成
							i = result.setTarget(illustId, target[0], 0, 1);
							// msg("到手" + parsed + "页，就剩" + (url.length - parsed) + "页啦 (ฅ´ω`ฅ)");
							console.log("记录单图或动图", i);
						} else {
							result.recordTargetLength(illustId, target[0]);
							// 多图需要再次解析链接
							console.warn("多图需要再次解析链接", target);
							for (i = 0; i < target[0]; i++) {
								result.setTarget(illustId, target[1] + i, i, 0);
								console.log(target[1] + i);
							}
							parseMultiImageUrl(target[0], target[1], function (obj) {
								console.warn("parseMultiImageUrl:callback", obj);
								console.log("搞到这 ", target[0], " 张图啦 （⺻▽⺻ ）");
								for (var i = 0; i < target[0]; i++) {
									var status = (undefined !== obj.done[i] && undefined === obj.fail[i]) ? 1 : -1;
									result.setTarget(illustId, obj.done[i], i, status);
								}
								exportImages();
							});
						}
					} else {
						recordFails(illustId, xhr.status);
					}
				} else {
					recordFails(illustId, xhr.status);
				}
				exportImages();
				console.groupEnd();
			},
			function (illustId, xhr) {
				console.group("页面", illustId, ", 获取失败", illustId == xhr.finalUrl.replace(/.*illust_id=(\d+).*/, "$1"));
				progress++;
				msg("进度" + progress + "/" + url.length + " (ฅ´ω`ฅ)");

				recordFails(illustId, xhr.status);
				exportImages();
				console.groupEnd();
		});
		console.groupEnd();
	};

	// 添加按钮
	var addButtonWorkList = function () {
		var i,
		button,
		menu,
		itemList = $class("_image-items");

		if (itemList) {
			menu = $class('menu-items')[0];

			// 全选按钮
			button = document.createElement('li');
			button.innerHTML="<a href='javascript:;'>全选</a>";
			button.addEventListener("click", function () {
				ctrlSelectAll();
			});
			menu.appendChild(button);

			// 反选按钮
			button = document.createElement('li');
			button.innerHTML="<a href='javascript:;'>反选</a>";
			button.addEventListener("click", function () {
				ctrlSelectInvert();
			});
			menu.appendChild(button);

			// 导出按钮
			button = document.createElement('li');
			button.innerHTML="<a href='javascript:;'>收割 ๑乛◡乛๑ (●´∀｀●)</a><span id='extracted'></span>";
			button.addEventListener("click", function () {
				extractWorkList();
			});
			menu.appendChild(button);

			// 添加复选框
			addStyle();
			for (i = 0; i < itemList[0].children.length; i++) {
				button = document.createElement('input');
				button.type = "checkbox";
				button.className = "cmheia_checkbox";
				button.checked = !0;
				// a
				// 删除原先的链接
				itemList[0].children[i].children[0].removeAttribute('href');
				// 增加背景
				itemList[0].children[i].children[0].setAttribute('style', 'margin-bottom:0;');
				addClassName(itemList[0].children[i].children[0], 'cmheia_item');
				// addClassName(itemList[0].children[i].children[0], 'cmheia_item_selected');
				// div
				// 增加点击事件
				itemList[0].children[i].children[0].children[0].appendChild(button);
				itemList[0].children[i].children[0].children[0].addEventListener("click", function (e) {
					// 点击图片切换选中状态
					this.children[1].checked = !this.children[1].checked;
					toggleClassName(this.parentNode, 'cmheia_item_selected');
				});
			}
		}
	};

	/*
	 * 已废弃代码
	 */
	// 从 html 源码提取单图链接
	var extractWorkPageSingle = function (html) {
		// 单图特征: html 中包含字符串 "original-image"
		// 多图特征: html 中包含字符串 "multiple"
		console.group('extractWorkPageSingle');
		var imgTag,
		result = [];
		imgTag = html.match(/<img\s+alt=\"[^\"]*\".*data-src=\"([^\"]*)\".*class=\"original-image\">/);
		console.log(imgTag);
		if (imgTag && imgTag[1]) {
			result[0] = imgTag[1];
		}
		console.log(result);
		// imgTag = html.match(/<img\s+alt=\"[^\"]*\".*class=\"original-image\">/);
		// if (imgTag && imgTag = imgTag[0].match(/data-src=\"([^\"]*)\"/)) {
		// 	if (imgTag) {
		// 		return imgTag[1];
		// 	}
		// }
		console.groupEnd();
		return result;
	};

	// 从 html 源码提取图集链接
	var extractWorkPageMultiple = function (html, url) {
		// 单图特征: html 中包含字符串 "original-image"
		// 多图特征: html 中包含字符串 "multiple"
		console.group('extractWorkPageMultiple');
		var imgTag,
		result = [];
		imgTag = html.match(/<img\s+alt=\"[^\"]*\".*data-src=\"([^\"]*)\".*class=\"original-image\">/);
		console.log(imgTag);
		if (imgTag && imgTag[1]) {
			result[0] = imgTag[1];
		}
		console.log(result);
		console.groupEnd();
		return result;
	};

	/**********************************************************************
	 * 作品页面功能
	 **********************************************************************/
	// 移除分享按钮
	var removeShareButton = function () {
		var i,
		shareButton = $class('share-button')[0],
		count = shareButton.childNodes.length;
		for (i = 0; i < count; i++) {
			shareButton.removeChild(shareButton.childNodes[0]);
		}
	};

	// 取得图集信息
	// return: -1 -> 分析失败, 0 ->单图, > 0 -> 多图
	var isMulti = function () {
		// 单图特征: thumbnail === "DIV" && albumMeta === (\d+)×(\d+)
		// 多图特征: thumbnail === "A" && albumMeta === "一次性投稿多张作品 "(\d+)"P"
		// 多图特征: thumbnail === "A" && albumMeta === "複数枚投稿 "(\d+)"P"
		// 多图特征: thumbnail === "A" && albumMeta === "Multiple images: "(\d+)"P"
		// 多图特征: thumbnail === "A" && albumMeta === "여러 장 투고 "(\d+)"P"
		/*
		var a,
		albumMeta = $class('meta')[0].childNodes[1].innerHTML;

		if ("A" === $class('works_display')[0].childNodes[0].nodeName) {
			a = albumMeta.match(/(\d+)/gi);
			if (null !== a) {
				return parseInt(a[0]);
			} else {
				return -1;
			}
		} else {
			if (albumMeta.match(/(\d+)×(\d+)/gi)) {
				return 0;
			} else {
				return -1;
			}
		}
		return -1;
		*/

		// 单图特征: html 中包含字符串 "original-image"
		// 多图特征: html 中包含字符串 "multiple"
		var result = -1;
		if ($class('works_display')[0].innerHTML.indexOf("multiple") > -1) {
			// 多图
			try {
				result = parseInt($class('meta')[0].children[1].innerHTML.match(/(\d+)/gi));
			} catch (e) {
				console.error("看似多图却不能发现有几图,实属不该");
			}
		} else {
			// 单图
			result = 0;
		}
		return result;
	};

	// 导出原图链接
	var extractWorkPage = function () {
		var illustType = isMulti();
		if (0 === illustType) {
			var result = parseImageUrl($class('original-image')[0].getAttribute("data-src"));
			if (null !== result) {
				msg("搞到这张图啦 （⺻▽⺻ ）");
				GM_setClipboard(result);
			} else {
				msg("然而并不能收割 (╯#-_-)╯~~~~~~~~~~~~~~~~~╧═╧");
			}
		} else if (0 < illustType) {
			if (0 === parseMultiImageUrl(illustType, window.location.href.replace(/medium/, "manga_big") + "&page=", function (result) {
					console.log("parseMultiImageUrl:done!");
					msg("搞到这 " + illustType + " 张图啦 （⺻▽⺻ ）");
					GM_setClipboard(result.done.join("\r\n"));
			})) {
				msg("然而并不能收割 (╯#-_-)╯~~~~~~~~~~~~~~~~~╧═╧");
			} else {
				msg("正在搞这 " + illustType + " 张图，不要急嘛 (๑•̀_•́๑)");
			}
		} else {
			msg("P站又改版了 (╯#-_-)╯~~~~~~~~~~~~~~~~~╧═╧");
		}
	};

	// 添加导出按钮
	var addButtonWorkPage = function () {
		var button = document.createElement('li');
		button.innerHTML="<a href='javascript:;' style='margin:0 8px;'>收割 ๑乛◡乛๑ (●´∀｀●)</a><span id='extracted'></span>";
		button.addEventListener("click", function () {
			extractWorkPage();
		});
		$class('share-button')[0].appendChild(button);
	};

	// 运行
	console.warn("P站原图收割机：开始");
	if (isWorksList()) {
		addButtonWorkList();
		document.addEventListener("keyup", function (event) {
			// F9 = 120
			if (120 === event.keyCode ) {
				extractWorkList();
			}
		}, true);
	} else {
		removeShareButton();
		addButtonWorkPage();
		document.addEventListener("keyup", function (event) {
			// F9 = 120
			if (120 === event.keyCode) {
				extractWorkPage();
			}
		}, true);
	}
}) ();
