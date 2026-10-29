import asyncio, json, subprocess
from pathlib import Path
from playwright.async_api import async_playwright, expect

async def main():
    root='/workspace/worktrees/replay'
    evidence={'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'delta':subprocess.check_output(['git','diff','--stat'],cwd=root,text=True),'fixture':'Two 8s synthetic MP4s; same frames, differing container metadata; timing mechanics only.'}
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
        page=await browser.new_page(viewport={'width':390,'height':844})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://127.0.0.1:4175/')
        await page.get_by_test_id('import-video').set_input_files([f'{root}/tests/coach/generated/source.mp4',f'{root}/tests/coach/generated/comparison-second.mp4'])
        await page.wait_for_function("document.querySelectorAll('.collection button').length === 2")
        await page.get_by_label('Vídeo A',exact=True).select_option(label='source.mp4')
        await page.get_by_label('Vídeo B',exact=True).select_option(label='comparison-second.mp4')
        await expect(page.get_by_role('button',name='Reproduzir comparação',exact=True)).to_be_enabled()
        await page.get_by_label('Referência A (s)',exact=True).fill('3')
        await page.get_by_label('Referência B (s)',exact=True).fill('1')
        await expect(page.get_by_test_id('comparison-coverage')).to_contain_text('deslocamento B − A: -2.00 s')
        await page.get_by_role('button',name='Ir às referências',exact=True).click()
        await page.get_by_role('button',name='Reproduzir comparação',exact=True).click()
        await page.wait_for_timeout(800)
        await page.get_by_role('button',name='Pausar comparação',exact=True).click()
        probe="""() => ({a:document.querySelector('[data-testid=compare-a]').currentTime,b:document.querySelector('[data-testid=compare-b]').currentTime,paused:Array.from(document.querySelectorAll('.comparison-panel video')).every(v=>v.paused),overflow:document.documentElement.scrollWidth > innerWidth,coverage:document.querySelector('[data-testid=comparison-coverage]').textContent})"""
        evidence['paused']=await page.evaluate(probe)
        assert evidence['paused']['paused']
        assert abs(evidence['paused']['b']-evidence['paused']['a']+2)<0.1
        assert not evidence['paused']['overflow']
        await page.locator('.comparison-panel').screenshot(path='/workspace/sprint/review/comparison-negative-offset.png')
        await page.reload()
        await expect(page.get_by_role('button',name='Reproduzir comparação',exact=True)).to_be_enabled()
        await page.wait_for_timeout(250)
        evidence['restored']=await page.evaluate(probe)
        assert abs(evidence['restored']['a']-evidence['paused']['a'])<0.1
        assert abs(evidence['restored']['b']-evidence['restored']['a']+2)<0.1
        evidence['pageerrors']=errors
        evidence['ending_head']=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
        await browser.close()
    Path('/workspace/sprint/review/comparison-negative-offset-probe.json').write_text(json.dumps(evidence,indent=2))
    print(json.dumps(evidence,indent=2))
asyncio.run(main())
