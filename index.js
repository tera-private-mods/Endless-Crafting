/* eslint-disable no-undef */
/* eslint-disable no-constant-condition */
// created by Bubble
// rewritten by TerableCoder
String.prototype.clr = function(hexColor) { return `<font color='#${hexColor}'>${this}</font>`;};

module.exports = function EndlessCrafting(mod) {
	const { player } = mod.require.library;
	const command = mod.command || mod.require.command,
		PIE_ID = 206023,
		PIE_AB_ID = 70264;

	const recipes = new Map;
    mod.queryData('/ItemProduceRecipe/Recipe/', [0], true, false, ['id','subFatiguePoint']).then(results => {
        results.forEach(entry => { 
			recipes.set(entry.attributes.id, entry.attributes);
		})
    });

	mod.dispatch.addDefinition("S_FATIGABILITY_POINT", 3, [
		["unk", "int32"],
		["maxFatigability", "int32"],
		["fatigability", "int32"]
	]);

	mod.game.initialize("inventory");

	let craftItem = null,
		pp = 2000,
		craftPP = 0,
		cureDbid = 0n,
		enabled = false,
		timeout = null,
		usePie = false,
		extraDelay = 0,
		numCrafts = 0,
		numCrits = 0,
		hooks = [];

	command.add("craft", {
		$none() {
			enabled = !enabled;
			command.message(`Endless crafting module ${ enabled ? "enabled." : "disabled."}`);
			(enabled) ? load() : unload();
			if (mod.settings.delay < 0) {
				mod.settings.delay = 0;
				command.message("Invalid mod.settings.delay, delay is now 0");
			}
		},
		unlock() {
			unlock();
		},
		pie() {
			mod.settings.reUsePie = !mod.settings.reUsePie;
			command.message(`Pie reuse is now ${ mod.settings.reUsePie}` ? "on" : "off");
		},
		delay(number) {
			const tempDelay = parseInt(number);
			if (tempDelay && tempDelay >= 0) {
				mod.settings.delay = tempDelay;
				command.message(`Crafting delay set to ${ mod.settings.delay}`);
			} else {
				command.message(`Invalid crafting delay. Current delay = ${ mod.settings.delay}`);
			}
		},
		$default(chatLink) {
			const regexId = /#(\d*)@/;
			const regexDbid = /@(\d*)@/;
			const id = chatLink.match(regexId);
			const dbid = chatLink.match(regexDbid);
			if (id && dbid) {
				mod.settings.cureId = parseInt(id[1]); // Normal: 181100, elite: 182439
				cureDbid = BigInt(parseInt(dbid[1]));
				command.message(`Using pp consumable with id:${ mod.settings.cureId}`);
			} else {
				command.message("Error, not a chatLink nor delay. Please type \"craft <Item>\" or \"craft delay aNumber\". Link the item with Ctrl+LMB.");
			}
		}
	});


	function unlock() {
		clearTimeout(timeout);
		timeout = mod.setTimeout(() => {
			mod.send("S_START_PRODUCE", 3, {
				duration: 0
			});
		}, 0);
	}

	function doneCrafting() {
		command.message(`You crafted ${numCrafts.toString().clr("00BFFF")} times and crit ${numCrits.toString().clr("32CD32")} times.`);
		unlock();
	}

	function hook() { hooks.push(mod.hook(...arguments)); }

	function unload() {
		clearTimeout(timeout);
		timeout = setTimeout(doneCrafting, 5000); // send fake failed craft after 5 sec to unlock the character
		if (hooks.length) {
			for (const h of hooks)
				mod.unhook(h);
			hooks = [];
		}
	}

	function load() {
		if (!hooks.length) {
			numCrafts = 0;
			numCrits = 0;

			hook("S_ABNORMALITY_END", 1, event => {
				if (event.id == PIE_AB_ID && mod.settings.reUsePie && mod.game.me.is(event.target)) {
					usePie = true;
				}
			});

			hook("S_FATIGABILITY_POINT", 3, event => {
				pp = event.fatigability;
			});

			hook("C_START_PRODUCE", 1, event => {
				craftItem = event;
				craftPP = recipes.get(event.recipe).subFatiguePoint;
			});

			hook("S_PRODUCE_CRITICAL", 1, event => {
				numCrits++;
			});

			hook("S_END_PRODUCE", 1, event => {
				if (!event.success) return;
				numCrafts++;
				extraDelay = 0;

				if (usePie) {
					usePie = false;
					const foundPie = mod.game.inventory.findInBagOrPockets(PIE_ID); // get Item
					if (foundPie && foundPie.amount > 0) {
						extraDelay = 5000;
						command.message("Using Moongourd Pie.");
						mod.setTimeout(() => {
							useItem(PIE_ID);
						}, extraDelay / 2);
					} else {
						command.message("You have 0 Moongourd Pies.");
					}
				}
				//We receive the S_FATIGABILITY_POINT packet AFTER crafting finishes,
				//so we need to account for the previous craft cost as well.
				if(pp < craftPP*2) { 
					command.message(`Using Elinu's Tear. ${pp}`);
					extraDelay += 1000;
					mod.setTimeout(() => {
						useItem(mod.settings.cureId);
						mod.hookOnce("S_FATIGABILITY_POINT", 3, (e) => {
							mod.send("C_START_PRODUCE", 1, craftItem);
						});
					}, 50 + extraDelay);
				} else {
					clearTimeout(timeout);
					timeout = mod.setTimeout(() => {
						mod.send("C_START_PRODUCE", 1, craftItem);
					}, mod.settings.delay + extraDelay);
				}
			});
		}
	}

	function useItem(id) {
		if (!player)
			return;
		mod.send("C_USE_ITEM", 3, {
			gameId: mod.game.me.gameId,
			id: id,
			amount: 1,
			loc: player.loc,
			w: player.loc.w,
			unk4: true
		});
	}
};