<template>
  <view class="batch-apply-container">
    <view class="batch-apply-title">
      <view class="batch-main-title">{{ mainTitle }}</view>
      <view class="batch-sub-title"
        >{{ subTitle
        }}<text class="batch-sub-text">{{ subTitleRed }}</text></view
      >
    </view>
    <view
      class="ptp_exposure_batch batch-apply-close iconfont iconclose"
      data-ptpid="811220961893"
      @click="hideVisible"
    ></view>
    <view v-if="visible" class="batch-apply-tabs">
      <view class="batch-apply-tabs-scroll">
        <view
          v-for="(item, index) in tabs"
          @click="handleTab(index, item)"
          data-ptpid="811220961889"
          :data-remark="'preferenceContent_' + item.name"
          :data-index="index"
          :class="[
            'ptp_exposure_batch',
            'batch-apply-tab',
            { active: index === currentTab },
          ]"
        >
          <view>{{ item.name }}</view>
        </view>
      </view>
    </view>
    <view v-for="(tab, tabIndex) in tabs" :nameIndex="tab.index" key="labelId">
      <view
        v-show="tabIndex === currentTab"
        class="batch-apply-job-list"
        :style="{ height: tabsHeight }"
      >
        <JobItem
          v-for="(job, index) in tab.jobList[tab.index]"
          :index="index"
          :remark="'clickType_batch&preferenceContent_' + tab.name"
          key="partJobId"
          :data="job"
          @change="handleChange(job)"
          pid="811220961890"
          selectPid="822221401929"
        />
        <DefaultPage
          v-if="tab.fetched && !tab.jobList[tab.index]"
          subtext="暂无数据，请稍后再试"
        ></DefaultPage>
      </view>
    </view>
    <view class="f_jb_ac batch-apply-job-bottom batch-bottom-fixed">
      <view
        class="ptp_exposure_batch-button-replace change-a-batch-btn f_jc_ac"
        v-if="tabs[currentTab].hasNext"
        @click="handleChangeBatch"
        data-ptpid="811220961917"
        :data-remark="'preferenceContent_' + tabs[currentTab].name"
        ><view class="iconfont iconreplace"></view>换一批</view
      >
      <view
        class="ptp_exposure_batch-button batch-apply-job-confirm f_jc_ac"
        v-if="tabs[currentTab].jobList.length > 0"
        data-ptpid="811220961892"
        :data-remark="'preferenceContent_' + tabs[currentTab].name"
        @click="handleConfirm"
        data-pid="811220961892"
        data-jobPid="811220961890"
        :data-needReport="true"
        ><view>确认报名</view></view
      >
    </view>
  </view>
</template>
<script>
// 1 性能问题
// 2 作用域插槽
// 3 props
// 4 ref
// 5 指令
function render($ctx, { $each }, preRes) {
  const res = {
    a1: $ctx.mainTitle,
    a2: $ctx.subTitle,
    a3: $ctx.subTitleRed,
    h1: (event) => $ctx.hideVisible(event),
    a4: $ctx.visible,
  }

  if (preRes.a4 != res.a4) {
    Object.assign(res, {
      a5: $each($ctx.tabs, (item, index) => ({
        a1: 'preferenceContent_' + item.name,
        a2: index,
        v1: index,
        a3: [
          'ptp_exposure_batch',
          'batch-apply-tab',
          { active: index === $ctx.currentTab },
        ],
        a4: item.name,
      })),
      h2: (event, index) => $ctx.handleTab(index, $ctx.tabs[index]),
    })
  }

  Object.assign(res, {
    a6: $each($ctx.tabs, (tab, tabIndex) => ({
      a1: tab.index,
      a2: tabIndex === currentTab,
      a3: { height: tabsHeight },
      a4: $each(tab.jobList[tab.index], (job, index) => {
        const res = {
          a1: index,
          a2: 'clickType_batch&preferenceContent_' + tab.name,
          a3: job,
          a4: tab.fetched && !tab.jobList[tab.index],
        }

        return res
      }),
    })),
    h3: (event, i1, i2) =>
      $ctx.handleChange($ctx.tabs[i1].jobList[$ctx.tabs[i1].index][i2]),
    a7: $ctx.tabs[$ctx.currentTab].hasNext,
  })

  if (res.a7) {
    Object.assign(res, {
      h4: (event) => $ctx.handleChangeBatch(event),
      a8: 'preferenceContent_' + $ctx.tabs[$ctx.currentTab].name,
    })
  }

  Object.assign(res, {
    a9: $ctx.tabs[currentTab].jobList.length > 0,
  })

  if (res.a9) {
    Object.assign(res, {
      a10: 'preferenceContent_' + $ctx.tabs[$ctx.currentTab].name,
      h5: (event) => $ctx.handleConfirm(event),
      a11: true,
    })
  }

  return res
}
</script>
