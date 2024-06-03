<template>
  <router-view />
</template>

<script setup lang="ts">

defineOptions({
  name: 'App'
});
</script>

<style lang="css">
body {
  margin: 0;
}

input {
  -webkit-appearance: none;
}

.app-container {
  font-family: 'Quicksand', sans-serif;
  padding: 30px;

  &.app-container-dark {
    background: #131415;
  }
}

.user-logged {
  font-size: 12px;
  margin-right: 5px;
  margin-top: 10px;

  &.user-logged-dark {
    color: #fff;
  }
}

select {
  height: 20px;
  outline: none;
  border: 1px solid #e0e2e4;
  border-radius: 4px;
  background: #fff;
  margin-bottom: 20px;
}

.button-theme {
  float: right;
  display: flex;
  align-items: center;

  .button-light {
    background: #fff;
    border: 1px solid #46484e;
    color: #46484e;
  }

  .button-dark {
    background: #1c1d21;
    border: 1px solid #1c1d21;
  }

  button {
    color: #fff;
    outline: none;
    cursor: pointer;
    border-radius: 4px;
    padding: 6px 12px;
    margin-left: 10px;
    border: none;
    font-size: 14px;
    transition: 0.3s;
    vertical-align: middle;

    &.button-github {
      height: 30px;
      background: none;
      padding: 0;
      margin-left: 20px;

      img {
        height: 30px;
      }
    }

    &:hover {
      opacity: 0.8;
    }

    &:active {
      opacity: 0.6;
    }

    @media only screen and (max-width: 768px) {
      padding: 3px 6px;
      font-size: 13px;
    }
  }
}
</style>
