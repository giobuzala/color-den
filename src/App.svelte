<script>
    import chroma from 'chroma-js';
    import { beforeUpdate, onMount, tick } from 'svelte';
    import Checkbox from './Checkbox.svelte';
    import InputColors from './InputColors.svelte';
    import PalettePreview from './PalettePreview.svelte';
    import Export from './Export.svelte';
    import StepChart from './StepChart.svelte';
    import Card from './Card.svelte';
    import ColorBlindCheck from './ColorBlindCheck.svelte';
    import ButtonGroup from './ButtonGroup.svelte';
    import AIChatbot from './AIChatbot.svelte';

    let steps = [];
    let bezier = true;
    let correctLightness = true;

    let colors = '00429d,96ffea,ffffe0'.split(/\s*,\s*/).map(c => chroma(c));
    let colors2 = 'ffffe0,ff005e,93003a'.split(/\s*,\s*/).map(c => chroma(c));
    let numColors = 9;
    let mode = 'sequential';
    let simulate = 'none';

    const baseHref = `${window.location.pathname}${window.location.search}`;
    let _historyKey = '';
    let _initialStateKey = '';
    let _historyReady = false;
    let _applyingFromHistory = false;

    if (window.location.hash) {
        readStateFromHash();
    }

    /** True when checkboxes + simulate (incl. status line width) do not fit on one row. */
    let step3ToolbarStacked = false;
    let step3ToolbarEl;
    let step3CheckGroupEl;
    let step3SimSlotEl;
    /** Kept while .res is hidden so we do not under-estimate width and flip layout in a loop. */
    let step3LastResWidth = 200;

    function measureStep3ToolbarStacked() {
        if (!step3ToolbarEl || !step3CheckGroupEl || !step3SimSlotEl) return;
        const simRoot = step3SimSlotEl.querySelector('.colorblind-sim');
        if (!simRoot) return;
        const resEl = simRoot.querySelector('.res');
        const simRow = simRoot.querySelector('.sim-row');
        const simRowW = simRow ? simRow.offsetWidth : 0;
        if (resEl && resEl.offsetWidth > 0) {
            step3LastResWidth = resEl.offsetWidth;
        }
        const simBlockW = Math.max(simRowW, step3LastResWidth);
        const gapX = 20;
        const checksW = step3CheckGroupEl.offsetWidth;
        const toolbarW = step3ToolbarEl.clientWidth;
        step3ToolbarStacked = checksW + simBlockW + gapX > toolbarW + 1;
    }

    $: if (step3ToolbarEl) {
        void steps.length;
        void simulate;
        tick().then(measureStep3ToolbarStacked);
    }

    onMount(() => {
        const run = () => {
            tick().then(measureStep3ToolbarStacked);
        };
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(run) : null;
        if (ro && step3ToolbarEl) ro.observe(step3ToolbarEl);
        if (ro && step3CheckGroupEl) ro.observe(step3CheckGroupEl);
        if (ro && step3SimSlotEl) ro.observe(step3SimSlotEl);
        run();
        window.addEventListener('resize', run);
        return () => {
            window.removeEventListener('resize', run);
            if (ro) ro.disconnect();
        };
    });

    let _mode = 'sequential';
    const validSimulations = ['none', 'deuteranopia', 'protanopia', 'tritanopia'];

    function clampNumColors(value) {
        const n = Math.round(+value);
        if (!isFinite(n)) return 2;
        return Math.min(50, Math.max(2, n));
    }

    $: {
        const clamped = clampNumColors(numColors);
        if (numColors !== clamped) {
            numColors = clamped;
        }
    }

    function getCurrentState() {
        return {
            numColors,
            mode: mode.slice(0, 1),
            colors: colors.map(c => c.hex().slice(1)).join(','),
            colors2: colors2.length ? colors2.map(c => c.hex().slice(1)).join(',') : '',
            correctLightness: correctLightness ? 1 : 0,
            bezier: bezier ? 1 : 0,
            simulate
        };
    }

    function getStateKey(state) {
        return [
            state.numColors,
            state.mode,
            state.colors,
            state.colors2,
            state.correctLightness,
            state.bezier,
            state.simulate
        ].join('|');
    }

    beforeUpdate(() => {
        if (!_applyingFromHistory) {
            const state = getCurrentState();
            const key = getStateKey(state);
            if (!_historyReady) {
                history.replaceState(state, '', baseHref);
                _historyReady = true;
                _historyKey = key;
                _initialStateKey = key;
            } else if (key !== _historyKey) {
                history.pushState(state, '', baseHref);
                _historyKey = key;
            }
        }
        if (mode !== _mode) {
            if (mode === 'diverging' && !colors2.length) {
                colors2 = colors.slice(0).reverse();
            }
            _mode = mode;
        }
    });

    function readStateFromHash() {
        const raw = window.location.hash.startsWith('#/') ? window.location.hash.slice(2) : '';
        // Be tolerant of percent-encoding (and occasional double-encoding) so shared links work
        // across chat apps and browsers.
        let decoded = raw;
        for (let i = 0; i < 2; i++) {
            try {
                decoded = decodeURIComponent(decoded);
            } catch (e) {
                break;
            }
        }
        decoded = decoded.replace(/%7C/gi, '|');
        const parts = decoded.split('|');
        if (parts.length === 6) {
            const parsedNumColors = Math.round(+parts[0]);
            const parsedMode =
                parts[1] === 's' ? 'sequential' : parts[1] === 'd' ? 'diverging' : null;
            if (!isFinite(parsedNumColors) || parsedNumColors < 2 || parsedNumColors > 50 || !parsedMode) {
                return;
            }

            const parsedColors = toChromaList(parts[2].split(','), colors);
            const parsedColors2 = parts[3] !== '' ? toChromaList(parts[3].split(','), colors2) : [];

            numColors = parsedNumColors;
            mode = parsedMode;
            _mode = parsedMode;
            colors = parsedColors;
            colors2 = parsedColors2;
            correctLightness = parts[4] === '1';
            bezier = parts[5] === '1';
        }
    }

    function hashChange() {
        if (window.location.hash) {
            readStateFromHash();
            const current = getCurrentState();
            history.replaceState(current, '', baseHref);
            _historyKey = getStateKey(current);
            if (!_historyReady) _initialStateKey = _historyKey;
            _historyReady = true;
        }
    }

    function applyHistoryState(state, fallbackColors, fallbackColors2) {
        const parsedNumColors = Math.round(+state.numColors);
        const parsedMode =
            state.mode === 's'
                ? 'sequential'
                : state.mode === 'd'
                  ? 'diverging'
                  : state.mode === 'sequential' || state.mode === 'diverging'
                    ? state.mode
                    : null;
        if (!isFinite(parsedNumColors) || parsedNumColors < 2 || parsedNumColors > 50 || !parsedMode) return false;

        const parsedColors = toChromaList(
            String(state.colors || '')
                .split(',')
                .filter(Boolean),
            fallbackColors
        );
        const parsedColors2 = String(state.colors2 || '').trim()
            ? toChromaList(
                  String(state.colors2)
                      .split(',')
                      .filter(Boolean),
                  fallbackColors2
              )
            : [];

        numColors = parsedNumColors;
        mode = parsedMode;
        _mode = parsedMode;
        colors = parsedColors;
        colors2 = parsedColors2;
        correctLightness = String(state.correctLightness) === '1' || state.correctLightness === true;
        bezier = String(state.bezier) === '1' || state.bezier === true;
        simulate = validSimulations.includes(state.simulate) ? state.simulate : 'none';
        return true;
    }

    function onPopState(event) {
        const state = event && event.state;
        if (!state) return;
        _applyingFromHistory = true;
        try {
            if (!applyHistoryState(state, colors, colors2)) return;
            _historyKey = getStateKey(getCurrentState());
            _historyReady = true;
        } finally {
            _applyingFromHistory = false;
        }
    }

    function normalizeHex(rawColor) {
        if (typeof rawColor !== 'string') return null;
        const trimmed = rawColor.trim();
        if (!trimmed) return null;
        return trimmed[0] === '#' ? trimmed : `#${trimmed}`;
    }

    function toChromaList(rawColors, fallback) {
        if (!Array.isArray(rawColors) || !rawColors.length) return fallback;
        const parsed = rawColors
            .map(normalizeHex)
            .filter(Boolean)
            .map(color => {
                try {
                    return chroma(color);
                } catch (e) {
                    return null;
                }
            })
            .filter(Boolean);
        return parsed.length ? parsed : fallback;
    }

    function canUseBezierScale(inputColors) {
        return Array.isArray(inputColors) && inputColors.length > 1 && inputColors.length <= 5;
    }

    function handleApplyPalette(event) {
        const config = event && event.detail ? event.detail : {};
        const nextMode =
            config.mode === 'sequential' || config.mode === 'diverging' ? config.mode : mode;

        if (nextMode !== mode) {
            mode = nextMode;
        }

        const parsedNumColors = Math.round(+config.numColors);
        if (isFinite(parsedNumColors) && parsedNumColors >= 2 && parsedNumColors <= 50) {
            numColors = parsedNumColors;
        }

        if (typeof config.correctLightness === 'boolean') {
            correctLightness = config.correctLightness;
        }

        const nextColors = toChromaList(config.colors, colors);
        const nextColors2 =
            nextMode === 'diverging'
                ? toChromaList(config.colors2, colors2.length ? colors2 : nextColors.slice(0).reverse())
                : [];
        const requestedBezier = typeof config.bezier === 'boolean' ? config.bezier : bezier;

        colors = nextColors;
        bezier =
            requestedBezier &&
            canUseBezierScale(nextColors) &&
            (nextMode !== 'diverging' || canUseBezierScale(nextColors2));

        colors2 = nextColors2;
    }

    function goBack() {
        if (_historyKey === _initialStateKey) return;
        history.back();
    }

    function goForward() {
        history.forward();
    }

    $: currentPaletteForAI = {
        mode,
        numColors,
        colors: colors.map(color => color.hex()),
        colors2: colors2.map(color => color.hex()),
        bezier,
        correctLightness
    };
</script>

<style>
    .head {
        margin: 1.5em 0 1.8em;
    }
    .head-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    .history-controls {
        display: inline-flex;
        gap: 6px;
    }
    .history-btn {
        margin: 0;
        padding: 0.26rem 0.7rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: #fff;
        color: #374151;
        font-size: 0.85rem;
        font-weight: 600;
        line-height: 1.3;
        cursor: pointer;
    }
    .history-btn:hover {
        background: #f9fafb;
    }
    .head p {
        color: #6b7280;
        font-size: 0.92rem;
        margin-bottom: 0;
    }
    .step1-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem;
    }
    .step1-row .step1-field:first-child {
        flex: 0 0 55%;
    }
    .step1-field {
        display: flex;
        align-items: center;
        gap: 0.6rem;
    }
    .step1-field .label-text {
        color: #4b5563;
        white-space: nowrap;
    }
    input[type='number'] {
        width: 4.2em;
        text-align: center;
        margin: 0;
        border: 2px solid #d1d5db;
        border-radius: 8px;
        background: #fff;
        font-weight: 700;
        font-size: 0.98rem;
        padding: 0.4em 0.5em;
    }
    input[type='number']:focus {
        outline: none;
        border-color: #4b6cb7;
    }
    .foot {
        margin: 16px 0 0;
        padding-bottom: 20px;
    }
    .foot hr {
        border-color: #e5e7eb;
        margin: 0 0 10px;
    }
    .foot p {
        color: #4b5563;
        font-size: 0.9rem;
        margin: 0;
    }
    .repo-links {
        margin-top: 10px;
        display: inline-flex;
        align-items: center;
        gap: 10px;
    }
    .repo-link {
        width: 30px;
        height: 30px;
        border-radius: 999px;
        border: 1px solid #d1d5db;
        background: #fff;
        color: #111;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
    }
    .repo-link:hover {
        background: #f9fafb;
        color: #000;
    }
    .repo-link svg {
        width: 16px;
        height: 16px;
    }
    .foot p a {
        color: #3b6fc4;
    }
    .foot p a:hover {
        color: #3b6fc4;
    }
    .step3-toolbar {
        position: relative;
        margin-bottom: 10px;
    }
    .step3-toolbar-row {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 12px 20px;
    }
    .step3-check-group {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        gap: 1.25rem;
        flex: 0 1 auto;
        min-width: min-content;
    }
    .step3-sim-slot {
        flex: 0 1 auto;
        margin-left: auto;
        min-width: 0;
    }
    .step3-toolbar--stacked .step3-sim-slot {
        margin-left: 0;
        flex: 1 1 100%;
    }
    kbd {
        background-color: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        box-shadow: 0 1px 0 rgba(0, 0, 0, 0.08);
        color: #374151;
        display: inline-block;
        line-height: 1.4;
        margin: 0 0.1em;
        padding: 0.1em 0.5em;
        font-size: 0.85em;
    }
    :global(.custom-control-label) {
        color: #4b5563;
        font-size: 0.93rem;
    }
</style>

<svelte:window on:hashchange={hashChange} on:popstate={onPopState} />

<div class="container">
    <div class="head">
        <div class="head-top">
            <h1>Color Den: chroma.js Color Palette Copilot</h1>
            <div class="history-controls" aria-label="Palette history controls">
                <button class="history-btn" type="button" on:click={goBack} title="Go to previous palette state">Back</button>
                <button class="history-btn" type="button" on:click={goForward} title="Go to next palette state">Forward</button>
            </div>
        </div>
        <p>This <a href="https://github.com/gka/chroma.js" target="_blank">chroma.js</a>-powered tool is here to help us master <a href="https://www.vis4.net/blog/mastering-multi-hued-color-scales/" target="_blank">multi-hued, multi-stop color scales</a>, with a little help from AI.</p>
    </div>
    <Card step="1" title="What kind of palette do you want to create?">
        <div class="step1-row">
            <div class="step1-field">
                <span class="label-text">Palette type:</span>
                <ButtonGroup options={['sequential', 'diverging']} bind:value={mode} />
            </div>
            <div class="step1-field">
                <span class="label-text">Number of colors:</span>
                <input
                    type="number"
                    min="2"
                    max="50"
                    bind:value={numColors}
                    on:input={() => (numColors = clampNumColors(numColors))} />
            </div>
        </div>
    </Card>

    <Card step="2" title="Select and arrange input colors">
        <InputColors diverging={mode === 'diverging'} bind:colors bind:colors2 />
    </Card>

    <Card step="3" title="Check and configure the resulting palette">
        <div
            class="step3-toolbar"
            class:step3-toolbar--stacked={step3ToolbarStacked}
            bind:this={step3ToolbarEl}>
            <div class="step3-toolbar-row">
                <div class="step3-check-group" bind:this={step3CheckGroupEl}>
                    <Checkbox
                        bind:value={correctLightness}
                        inline={false}
                        label="correct lightness"
                        title="Adjust luminance so palette colors have perceptually even steps (avoids some appearing too dark or too light)." />
                    <Checkbox
                        bind:value={bezier}
                        inline={false}
                        label="bezier interpolation"
                        title="Interpolate along a Bézier curve in color space for smoother or more natural-looking gradients between colors." />
                </div>
                <div class="step3-sim-slot" bind:this={step3SimSlotEl}>
                    <ColorBlindCheck bind:colors={steps} bind:active={simulate} stacked={step3ToolbarStacked} />
                </div>
            </div>
        </div>
        <PalettePreview
            bind:steps
            bind:correctLightness
            bind:bezier
            bind:colors
            bind:colors2
            diverging={mode === 'diverging'}
            simulate={simulate}
            bind:numColors />
        <div class="row">
            <div class="col-md">
                <StepChart title="lightness" steps={steps} mode={0} />
            </div>
            <div class="col-md">
                <StepChart title="saturation" steps={steps} mode={1} />
            </div>
            <div class="col-md">
                <StepChart title="hue" steps={steps} mode={2} />
            </div>
        </div>
    </Card>

    <Card step="4" title="Export the color codes in various formats">
        <Export steps={steps} />
    </Card>
    <div class="foot">
        <hr>
        <p>
            Created by <a href="https://vis4.net/blog" target="_blank" rel="noopener noreferrer">Gregor Aisch</a> for the sake of better use of colors
            in maps and data visualizations, forked and extended by
            <a href="https://giobuzala.com/" target="_blank" rel="noopener noreferrer"
                >Giorgi Buzaladze</a
            >
            with an added AI layer.
        </p>
        <div class="repo-links" aria-label="Repository links">
            <a
                class="repo-link"
                href="https://github.com/gka/palettes"
                target="_blank"
                rel="noopener noreferrer"
                title="Original repository (gka/palettes)"
                aria-label="Original repository on GitHub">
                <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52 0-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.55 7.55 0 012 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                </svg>
            </a>
            <a
                class="repo-link"
                href="https://github.com/giobuzala/color-den"
                target="_blank"
                rel="noopener noreferrer"
                title="Fork repository (giobuzala/color-den)"
                aria-label="Fork repository on GitHub">
                <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M5 3.09a2.5 2.5 0 11-1 0V2.5a2.5 2.5 0 115 0v.59a2.5 2.5 0 11-1 0V2.5a1.5 1.5 0 10-3 0v.59zM3.5 4a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm5 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM2 9.5A2.5 2.5 0 014.5 7h3A2.5 2.5 0 0110 9.5V12a2 2 0 11-1 0V9.5A1.5 1.5 0 007.5 8h-3A1.5 1.5 0 003 9.5V12a2 2 0 11-1 0V9.5zm.5 3.5a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2z"></path>
                </svg>
            </a>
        </div>
    </div>
</div>

<AIChatbot currentPalette={currentPaletteForAI} on:applyPalette={handleApplyPalette} />