import asyncio, json, subprocess
from pathlib import Path
from playwright.async_api import async_playwright, expect
async def main():
    root='/workspace/worktrees/replay'
    evidence={'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'delta':subprocess.check_output(['git','diff','--stat'],cwd=root,text=True),'controlled_failure':'B first play delayed until release; second play rejects; then first late fulfillment starts native media.'}
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
        page=await browser.new_page()
        await page.goto('http://127.0.0.1:4175/')
        await page.get_by_test_id('import-video').set_input_files([f'{root}/tests/coach/generated/source.mp4',f'{root}/tests/coach/generated/comparison-second.mp4'])
        await page.wait_for_function("document.querySelectorAll('.collection button').length === 2")
        await page.get_by_label('Vídeo A',exact=True).select_option(label='source.mp4')
        await page.get_by_label('Vídeo B',exact=True).select_option(label='comparison-second.mp4')
        await expect(page.get_by_role('button',name='Reproduzir comparação',exact=True)).to_be_enabled()
        await page.evaluate("""() => { const b=document.querySelector('[data-testid=compare-b]'); const native=b.play.bind(b);let n=0;b.play=()=>{n++;if(n===1)return new Promise((resolve,reject)=>{window.releaseLate=()=>native().then(resolve,reject)});return Promise.reject(new Error('controlled retry rejection'));}; }""")
        await page.get_by_role('button',name='Reproduzir comparação',exact=True).click()
        await page.get_by_role('button',name='Cancelar início da comparação',exact=True).click()
        await page.get_by_role('button',name='Reproduzir comparação',exact=True).click()
        await expect(page.locator('.comparison-panel [role=status]')).to_contain_text('não iniciou')
        await page.evaluate('()=>window.releaseLate()')
        await page.wait_for_timeout(350)
        evidence['late_result']=await page.evaluate("""() => ({aPaused:document.querySelector('[data-testid=compare-a]').paused,bPaused:document.querySelector('[data-testid=compare-b]').paused,bTime:document.querySelector('[data-testid=compare-b]').currentTime,buttons:Array.from(document.querySelectorAll('.comparison-panel button')).map(x=>x.textContent)})""")
        assert evidence['late_result']['aPaused'] and evidence['late_result']['bPaused'], evidence['late_result']
        await browser.close()
    Path('/workspace/sprint/review/comparison-late-start-fixed.json').write_text(json.dumps(evidence,indent=2))
    print(json.dumps(evidence,indent=2))
asyncio.run(main())
