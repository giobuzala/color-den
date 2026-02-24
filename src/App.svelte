<script>
    import chroma from 'chroma-js';
    import { beforeUpdate } from 'svelte';
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
    let _historyReady = false;
    let _applyingFromHistory = false;

    if (window.location.hash) {
        readStateFromHash();
    }

    const isMac = navigator.platform.toUpperCase().includes('MAC');

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
            mode: mode.substr(0, 1),
            colors: colors.map(c => c.hex().substr(1)).join(','),
            colors2: colors2.length ? colors2.map(c => c.hex().substr(1)).join(',') : '',
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
        const raw = window.location.hash.startsWith('#/') ? window.location.hash.substr(2) : '';
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

    function handleApplyPalette(event) {
        const config = event && event.detail ? event.detail : {};

        if (config.mode === 'sequential' || config.mode === 'diverging') {
            mode = config.mode;
        }

        const parsedNumColors = Math.round(+config.numColors);
        if (isFinite(parsedNumColors) && parsedNumColors >= 2 && parsedNumColors <= 50) {
            numColors = parsedNumColors;
        }

        if (typeof config.bezier === 'boolean') {
            bezier = config.bezier;
        }
        if (typeof config.correctLightness === 'boolean') {
            correctLightness = config.correctLightness;
        }

        colors = toChromaList(config.colors, colors);

        if (mode === 'diverging') {
            colors2 = toChromaList(config.colors2, colors2.length ? colors2 : colors.slice(0).reverse());
        } else {
            colors2 = [];
        }
    }

    function goBack() {
        history.back();
    }

    function goForward() {
        history.forward();
    }
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
        <div class="row" style="margin-bottom: 10px">
            <div class="col-md">
                <Checkbox bind:value={correctLightness} label="correct lightness" title="Adjust luminance so palette colors have perceptually even steps (avoids some appearing too dark or too light)." />
                <Checkbox bind:value={bezier} label="bezier interpolation" title="Interpolate along a Bézier curve in color space for smoother or more natural-looking gradients between colors." />
            </div>
            <div class="col-md">
                <ColorBlindCheck bind:colors={steps} bind:active={simulate} />
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

<AIChatbot on:applyPalette={handleApplyPalette} />